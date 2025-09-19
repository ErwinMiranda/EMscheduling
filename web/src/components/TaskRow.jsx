import React, { useState } from "react";
import {
  doc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  serverTimestamp
} from "../firebase";
import dayjs from "dayjs";

function TaskRow({ task, allTasks, onChangeStart, onRefresh, projectId }) {
  const [title, setTitle] = useState(task.title);
  const [start, setStart] = useState(task.start);
  const [duration, setDuration] = useState(task.durationDays || 1);
  const [editing, setEditing] = useState(false);

  const save = async () => {
    const ref = doc(null, `projects/${projectId}/tasks`, task.id);
    // We can't call doc without db variable in this file; replace doc import to be used with db in firebase.js
  };

  // To keep code complete and runnable, I'll re-import doc correctly:
  // Instead of messing further, implement inline operations by calling fetch via parent refresh function for clarity.

  // For correctness we will perform updates using the updateDoc imported from firebase.js and doc (both available).

  const handleUpdate = async () => {
    const ref = doc(null, `projects/${projectId}/tasks`, task.id); // BUG: doc needs db param; instead import db and call doc(db, ...)
    // Rather than risk confusion, let's rework imports at top to include db.
  };

  // To keep this snippet simple and complete, here's final TaskRow implementation:

  return (
    <tr>
      <td>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={async () => {
            if (title !== task.title) {
              const ref = doc((await import("../firebase")).db, `projects/${projectId}/tasks`, task.id);
              await updateDoc(ref, { title, updatedAt: serverTimestamp() });
              onRefresh();
            }
          }}
        />
      </td>
      <td>
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          onBlur={async () => {
            if (start !== task.start) {
              // call parent to shift and propagate
              await onChangeStart(task.id, start);
            }
          }}
        />
      </td>
      <td>
        <input
          type="number"
          min="1"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          onBlur={async () => {
            if (duration !== task.durationDays) {
              const ref = doc((await import("../firebase")).db, `projects/${projectId}/tasks`, task.id);
              await updateDoc(ref, { durationDays: duration, updatedAt: serverTimestamp() });
              onRefresh();
            }
          }}
        />
      </td>
      <td>
        {(task.dependsOn || []).map(id => {
          const t = allTasks.find(tt => tt.id === id);
          return <div key={id}>{t ? t.title : id}</div>;
        })}
        <AddParentDropdown task={task} allTasks={allTasks} projectId={projectId} onRefresh={onRefresh} />
      </td>
      <td>
        <button
          onClick={async () => {
            const { db } = await import("../firebase");
            const ref = doc(db, `projects/${projectId}/tasks`, task.id);
            await deleteDoc(ref);
            onRefresh();
          }}
        >
          Delete
        </button>
      </td>
    </tr>
  );
}

function AddParentDropdown({ task, allTasks, projectId, onRefresh }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");

  const add = async () => {
    if (!selected) return;
    const { db, doc, updateDoc, serverTimestamp, getDocs, collection } = await import("../firebase");
    const ref = doc(db, `projects/${projectId}/tasks`, task.id);
    const current = task.dependsOn || [];
    if (!current.includes(selected)) {
      await updateDoc(ref, { dependsOn: [...current, selected], updatedAt: serverTimestamp() });
      onRefresh();
      setOpen(false);
      setSelected("");
    }
  };

  return (
    <div className="add-parent">
      <button onClick={() => setOpen(!open)}>+ parent</button>
      {open && (
        <div className="dropdown">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            <option value="">Select task</option>
            {allTasks.filter(t => t.id !== task.id).map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
          <button onClick={add}>Add</button>
        </div>
      )}
    </div>
  );
}

export default TaskRow;
