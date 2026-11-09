import './styles/app.css';
import 'virtual:lifting-sim';
import * as CAE from './core/index.js';
import * as GFX from './graphics/index.js';

window.CAE = CAE;
window.GFX = GFX;
console.info('[Lifting Plan Simulator Pro] CAE Industrial Physics & GFX Hyper-Realistic Pipeline Initialized:', { CAE: Object.keys(CAE), GFX: Object.keys(GFX) });
