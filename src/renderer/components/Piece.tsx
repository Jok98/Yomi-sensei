import { pieceColor } from '../../shared/game';

export function Piece({ piece }: { piece: string }) {
  const color = pieceColor(piece) === 'white' ? 'w' : 'b';
  return (
    <img
      className="piece-image"
      src={`${import.meta.env.BASE_URL}pieces/cburnett/${color}${piece.toUpperCase()}.svg`}
      alt=""
      draggable={false}
      aria-hidden="true"
    />
  );
}
