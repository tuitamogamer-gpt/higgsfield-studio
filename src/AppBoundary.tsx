import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ArrowRight, RefreshCw, Clapperboard } from "lucide-react";
export default class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean; revision: number }
> {
  state = { failed: false, revision: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    document.body.style.overflow = "";
  }
  render() {
    if (!this.state.failed)
      return <div key={this.state.revision}>{this.props.children}</div>;
    return (
      <main className="app-recovery">
        <span className="app-recovery-symbol">
          <Clapperboard size={31} />
        </span>
        <span className="eyebrow">TVOJ STUDIO</span>
        <h1>
          Vratimo te stvaranju<span>.</span>
        </h1>
        <p>
          Prikaz se nije uspio učitati. Pokušaj ponovno otvoriti studio.
          <br />
          Spremljena lokalna povijest i postavke neće se obrisati.
        </p>
        <button
          className="primary-button"
          onClick={() =>
            this.setState((s) => ({ failed: false, revision: s.revision + 1 }))
          }
        >
          <RefreshCw size={16} /> Ponovno otvori studio <ArrowRight size={16} />
        </button>
        <button
          className="text-button"
          onClick={() => window.location.reload()}
        >
          Osvježi cijelu aplikaciju
        </button>
      </main>
    );
  }
}
