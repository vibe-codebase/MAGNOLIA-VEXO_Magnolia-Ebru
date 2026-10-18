import { createRoot } from 'react-dom/client';
import '@fontsource/gloock/latin-400.css';
import '@fontsource/instrument-sans/latin-500.css';
import '@fontsource/instrument-sans/latin-600.css';
import '@fontsource/instrument-sans/latin-700.css';
import './styles.css';
import App from './App';
import { marbleUrl } from './ui/marble';

// the buttons are cut from sheets of marbled paper made by the bath itself
const root = document.documentElement.style;
root.setProperty('--marble-red', `url(${marbleUrl(['#a8322a', '#c4553a', '#7d2220', '#d9a441'], '#5e1c18', 7)})`);
root.setProperty('--marble-teal', `url(${marbleUrl(['#1e4d55', '#2c6a6c', '#173a44', '#c9a24a'], '#0f2a31', 11)})`);
createRoot(document.getElementById('root')!).render(<App />);
