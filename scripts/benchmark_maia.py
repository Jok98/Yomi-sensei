"""Measure real local inference, separately from unit tests and account calls."""
import asyncio
import json
from pathlib import Path
import statistics
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import chess
from app.maia_service import MaiaService
from app.models import MaiaProfile


async def main():
    root = Path(__file__).resolve().parent.parent
    service = MaiaService(str(root / '.runtime/maia'), [str(root / '.venv-maia/Scripts/python.exe'), '-u', str(root / 'app/maia_worker.py')])
    boards = []
    board = chess.Board()
    boards.append(board.copy())
    for uci in 'e2e4 e7e5 g1f3 b8c6 f1b5 a7a6 b5a4 g8f6 e1g1 f8e7'.split():
        board.push_uci(uci)
        boards.append(board.copy())
    results = []
    try:
        for model in ('5m', '79m'):
            samples = []
            profile = MaiaProfile(maia_model=model)
            for board in boards:
                started = time.perf_counter()
                prediction = await service.predict(board, profile)
                samples.append((time.perf_counter() - started) * 1000)
                candidates = service.candidates(board, prediction)
                assert candidates and sum(candidate.move_probability_percent for candidate in candidates) <= 100.02
                assert all(chess.Move.from_uci(candidate.uci) in board.legal_moves for candidate in candidates)
            results.append({'model': model, 'device': prediction['device'], 'cold_ms': round(samples[0], 1), 'warm_median_ms': round(statistics.median(samples[1:]), 1), 'warm_max_ms': round(max(samples[1:]), 1), 'positions': len(boards)})
        root.joinpath('artifacts').mkdir(exist_ok=True)
        root.joinpath('artifacts/maia-benchmark.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
        print(json.dumps(results, indent=2))
    finally:
        await service.close()


if __name__ == '__main__':
    asyncio.run(main())
