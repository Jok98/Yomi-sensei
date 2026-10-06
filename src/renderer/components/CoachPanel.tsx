import { useEffect, useRef, useState } from 'react';
import type { GameController, GameState } from '../controller';
import { Icon } from '../Icon';

export function CoachPanel({ game, controller }: { game: GameState; controller: GameController }) {
  const [draft, setDraft] = useState('');
  const [model, setModel] = useState('');
  const [reasoning, setReasoning] = useState('medium');
  const scroll = useRef<HTMLDivElement>(null);
  const selected = game.models?.models.find((option) => option.slug === model);
  const levels = selected?.supported_reasoning_levels ?? ['low', 'medium', 'high', 'xhigh'];
  useEffect(() => {
    if (game.models?.configured_model) setModel(game.models.configured_model);
  }, [game.models]);
  useEffect(() => {
    if (!levels.includes(reasoning)) setReasoning(selected?.default_reasoning_level ?? levels[0]);
  }, [model, game.models]);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight });
  }, [game.chat, game.chatBusy]);
  const send = (text: string) => {
    if (!text.trim() || game.chatBusy || !game.position) return;
    setDraft('');
    void controller.sendChat(text, model || null, reasoning || null);
  };
  return (
    <div className="coach-content">
      <div className="coach-settings">
        <label>
          Modello
          <select
            aria-label="Modello Codex"
            value={model}
            disabled={game.chatBusy}
            onChange={(event) => setModel(event.target.value)}
          >
            <option value="">Automatico account</option>
            {game.models?.models.map((option) => (
              <option key={option.slug} value={option.slug}>
                {option.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Reasoning
          <select
            aria-label="Reasoning"
            value={reasoning}
            disabled={game.chatBusy}
            onChange={(event) => setReasoning(event.target.value)}
          >
            {levels.map((level) => (
              <option value={level} key={level}>
                {level}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="chat-messages" aria-live="polite" ref={scroll}>
        {!game.chat.length && (
          <div className="empty-state coach-empty">
            <Icon name="chat" size={28} />
            <strong>Studia la posizione</strong>
            <p>Chiedi un piano, una variante o il motivo di una mossa.</p>
          </div>
        )}
        {game.chat.map((item) => (
          <article
            key={item.id}
            className={`chat-message ${item.role} ${item.error ? 'error' : ''}`}
          >
            <div className="message-author">
              {item.role === 'user' ? 'Tu' : 'Yomi Sensei'}
              {item.fen !== game.position?.fen && <small>Posizione precedente</small>}
            </div>
            <p>{item.content}</p>
          </article>
        ))}
        {game.chatBusy && (
          <div className="chat-thinking">
            <span className="spinner" />
            Yomi sta ragionando…
          </div>
        )}
      </div>
      <div className="prompt-actions">
        {['Qual è il piano?', 'Spiega la prima mossa', 'Ci sono minacce tattiche?'].map((text) => (
          <button key={text} disabled={game.chatBusy || !game.position} onClick={() => send(text)}>
            {text}
          </button>
        ))}
      </div>
      <form
        className="chat-composer"
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
      >
        <textarea
          aria-label="Messaggio per Yomi"
          placeholder="Chiedi della posizione…"
          value={draft}
          maxLength={4000}
          rows={3}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send(draft);
            }
          }}
        />
        <button
          className="primary send-button"
          aria-label="Invia messaggio"
          disabled={!draft.trim() || game.chatBusy || !game.position}
        >
          <Icon name="arrow" />
        </button>
      </form>
      <p className="privacy-note">
        FEN, mosse e messaggi vengono inviati a Codex quando usi la chat.
      </p>
    </div>
  );
}
