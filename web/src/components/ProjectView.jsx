import React, { useEffect, useState } from "react";
import {
  db,
  collection,
  addDoc,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  writeBatch,
  serverTimestamp
} from "../firebase";
import TaskRow from "./TaskRow";
import dayjs from "dayjs";

function ProjectView({ user }) {
  const [projectId, setProjectId] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(false);

  // For simplicity: single project per user. Create or find project.
  useEffect(() => {
    (async () => {
      setLoading(true);
      // find project owned by user
      const q = query(collection(db, "projects"), where("ownerId", "==", user.uid));
      const snaps = await getDocs(q);
      let pId;
      if (snaps.empty) {
        const docRef = await addDoc(collection(db, "projects"), {
          ownerId: user.uid,
          name: "My Project",
          createdAt: serverTimestamp()
        });
        pId = docRef.id;
      } else {
        pId = snaps.docs[0].id;
      }
      setProjectId(pId);
      setLoading(false);
    })();
  }, [user]);

  // load tasks listener (simple polling here — for clarity we use getDocs; you can upgrade to onSnapshot)
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const q = query(collection(db, `projects/${projectId}/tasks`), orderBy("createdAt"));
      const snap = await getDocs(q);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTasks(arr);
    })();
  }, [projectId]);

  // create task
  const createTask = async () => {
    if (!newTitle) return;
    const defaultStart = dayjs().format("YYYY-MM-DD");
    const docRef = await addDoc(collection(db, `projects/${projectId}/tasks`), {
      title: newTitle,
      start: defaultStart,
      durationDays: 1,
      dependsOn: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    setNewTitle("");
    // refresh
    const q = query(collection(db, `projects/${projectId}/tasks`), orderBy("createdAt"));
    const snap = await getDocs(q);
    setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // update a single task (and optionally propagate shift)
  const updateTaskWithPropagation = async (taskId, updates, propagate = true) => {
    // Load current task
    const taskRef = doc(db, `projects/${projectId}/tasks`, taskId);
    const snap = await taskRef.get?.() ?? await (async ()=>{ const ds = await getDocs(query(collection(db, `projects/${projectId}/tasks`), where("__name__", "==", taskId))); return ds.docs[0]; })();
    // Above is a compatibility fallback; simpler approach: just fetch doc using getDoc. Replace with getDoc
    // I'll use getDoc for clarity:
  };

  // Implement proper update function with propagation:
  const shiftTaskAndPropagate = async (taskId, newStart) => {
    // load all tasks into memory for graph traversal
    const q = query(collection(db, `projects/${projectId}/tasks`));
    const snap = await getDocs(q);
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const map = new Map(all.map(t => [t.id, t]));

    const t = map.get(taskId);
    if (!t) return;
    const oldStart = dayjs(t.start, "YYYY-MM-DD");
    const newStartDay = dayjs(newStart, "YYYY-MM-DD");
    const delta = newStartDay.diff(oldStart, "day"); // integer days

    if (delta === 0) return;

    // BFS/DFS propagation of shifts
    const updated = new Map(); // id -> {start, durationDays}
    const visited = new Set();

    function dfsShift(currentId, deltaDays) {
      if (visited.has(currentId)) return;
      visited.add(currentId);
      const cur = map.get(currentId);
      if (!cur) return;
      const curStart = dayjs(cur.start, "YYYY-MM-DD");
      const newS = curStart.add(deltaDays, "day").format("YYYY-MM-DD");
      updated.set(currentId, { ...cur, start: newS, updatedAt: new Date() });

      // find children: tasks that have currentId in their dependsOn
      for (const [id, candidate] of map.entries()) {
        if (candidate.dependsOn && candidate.dependsOn.includes(currentId)) {
          dfsShift(id, deltaDays);
        }
      }
    }

    // start with changed task: set its start to newStart
    updated.set(taskId, { ...t, start: newStart, updatedAt: new Date() });
    visited.add(taskId);
    // find children and propagate delta
    for (const [id, candidate] of map.entries()) {
      if (candidate.dependsOn && candidate.dependsOn.includes(taskId)) {
        dfsShift(id, delta);
      }
    }

    // Write updated tasks in batch
    const batch = writeBatch(db);
    for (const [id, data] of updated.entries()) {
      const ref = doc(db, `projects/${projectId}/tasks`, id);
      batch.update(ref, {
        start: data.start,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();

    // refresh UI: simple re-fetch
    const q2 = query(collection(db, `projects/${projectId}/tasks`), orderBy("createdAt"));
    const snap2 = await getDocs(q2);
    setTasks(snap2.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const addDependency = async (taskId, parentId) => {
    if (taskId === parentId) return;
    // load task
    const tRef = doc(db, `projects/${projectId}/tasks`, taskId);
    const tSnap = await tRef.get?.() ?? null;
    // use getDoc instead:
    // For clarity, use updateDoc to add parent
    await updateDoc(tRef, {
      dependsOn: ( (await getDocs(query(collection(db, `projects/${projectId}/tasks`), where("__name__", "==", taskId)))).docs[0].data().dependsOn || [] ).concat(parentId),
      updatedAt: serverTimestamp()
    });
    // refresh
    const q2 = query(collection(db, `projects/${projectId}/tasks`), orderBy("createdAt"));
    const snap2 = await getDocs(q2);
    setTasks(snap2.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // For simplicity: delete, update duration, edit title implemented inside TaskRow and they refresh via refetch

  return (
    <div className="project-view">
      <div className="project-controls">
        <div>
          <input
            placeholder="New task title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button onClick={createTask}>Add Task</button>
        </div>
      </div>

      <div className="task-list">
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Start</th>
              <th>Duration</th>
              <th>Depends On (parents)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                allTasks={tasks}
                onChangeStart={(id, newStart) => shiftTaskAndPropagate(id, newStart)}
                onRefresh={async () => {
                  const q = query(collection(db, `projects/${projectId}/tasks`), orderBy("createdAt"));
                  const snap = await getDocs(q);
                  setTasks(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                }}
                projectId={projectId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ProjectView;
