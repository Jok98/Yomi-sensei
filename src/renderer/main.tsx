import { createRoot } from 'react-dom/client';
import { App } from './App';
import { GameController } from './controller';
import './style.css';

const root = createRoot(document.getElementById('root')!);
if (!window.yomi)
  root.render(<div className="boot-error">Apri Yomi Sensei con Start.cmd o pnpm start.</div>);
else {
  const controller = new GameController(window.yomi);
  window.yomiFlush = () => controller.prepareClose();
  root.render(<App controller={controller} />);
  void controller.initialize();
}
