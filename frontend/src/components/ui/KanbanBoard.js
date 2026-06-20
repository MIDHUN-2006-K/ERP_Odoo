'use client';

import { useState, useRef } from 'react';

/**
 * Generic Kanban board with HTML5 drag-to-advance.
 * Props:
 *   columns    — [{ id, label, statusValue, cards: [...] }]
 *   renderCard — (card, colId) => ReactNode
 *   onDrop     — (cardId, fromColId, toColId) => Promise<void>
 */
export default function KanbanBoard({ columns = [], renderCard, onDrop }) {
  const [dragging, setDragging]   = useState(null); // { cardId, fromColId }
  const [dragOver, setDragOver]   = useState(null);  // colId
  const [loadingId, setLoadingId] = useState(null);

  function handleDragStart(e, cardId, colId) {
    setDragging({ cardId, fromColId: colId });
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e, colId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(colId);
  }

  function handleDragLeave() {
    setDragOver(null);
  }

  async function handleDrop(e, toColId) {
    e.preventDefault();
    setDragOver(null);
    if (!dragging) return;
    const { cardId, fromColId } = dragging;
    setDragging(null);
    if (fromColId === toColId) return;
    if (onDrop) {
      setLoadingId(cardId);
      try {
        await onDrop(cardId, fromColId, toColId);
      } finally {
        setLoadingId(null);
      }
    }
  }

  function handleDragEnd() {
    setDragging(null);
    setDragOver(null);
  }

  return (
    <div className="kanban-board kanban-board-4">
      {columns.map(col => (
        <div
          key={col.id}
          className={`kanban-column${dragOver === col.id ? ' drag-over' : ''}`}
          onDragOver={e => handleDragOver(e, col.id)}
          onDragLeave={handleDragLeave}
          onDrop={e => handleDrop(e, col.id)}
        >
          {/* Column header */}
          <div className="kanban-col-header">
            <div className="kanban-col-title">{col.label}</div>
            <div className="kanban-col-count">{col.cards.length}</div>
          </div>

          {/* Cards */}
          <div className="kanban-cards">
            {col.cards.length === 0 && (
              <div style={{
                padding: '1rem',
                textAlign: 'center',
                fontSize: 12,
                color: '#B4B2A9',
                border: '1.5px dashed #E8E3DD',
                borderRadius: 8,
                marginTop: 4,
              }}>
                Drop here
              </div>
            )}
            {col.cards.map(card => (
              <div
                key={card.id}
                className={`kanban-card${dragging?.cardId === card.id ? ' dragging' : ''}`}
                draggable
                onDragStart={e => handleDragStart(e, card.id, col.id)}
                onDragEnd={handleDragEnd}
                style={{ opacity: loadingId === card.id ? 0.5 : 1, position: 'relative' }}
              >
                {loadingId === card.id && (
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.7)',
                  }}>
                    <div className="spinner" style={{ width: 18, height: 18 }} />
                  </div>
                )}
                {renderCard(card, col.id)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
