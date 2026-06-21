import { Component, type ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 全局错误兜底：任意组件渲染崩溃时，不再整页白屏卡死，
 * 而是显示一张恢复卡，提供「重新加载」一键恢复（不用关掉 App 重开）。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // 打到控制台便于排查，不上传任何地方
    console.error('[ErrorBoundary] 渲染崩溃:', error, info.componentStack);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg p-8">
        <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-6 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-danger/10">
            <AlertTriangle size={20} className="text-danger" />
          </div>
          <h2 className="mb-1 text-sm font-semibold text-text">界面出错了</h2>
          <p className="mb-4 text-xs leading-relaxed text-muted">
            页面遇到一个错误暂时卡住了。点下面的按钮就能恢复，不用关掉 App 重开。
            <br />
            你的账号和凭据都安全保存在本机，不会丢失。
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-xs font-medium text-white transition-colors duration-150 hover:bg-accent/90"
            >
              <RefreshCw size={13} />
              重新加载
            </button>
            <button
              type="button"
              onClick={this.handleReset}
              className="rounded-md px-3 py-2 text-xs text-muted transition-colors duration-150 hover:bg-surface-2 hover:text-text"
            >
              先返回试试（不重新加载）
            </button>
          </div>
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-[11px] text-muted-2 transition-colors hover:text-muted">
              错误详情
            </summary>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-2 text-[10px] leading-relaxed text-muted">
              {error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}
