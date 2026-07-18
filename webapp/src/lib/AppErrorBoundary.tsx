import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StateBlock } from '../components/uiState';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  error: Error | null;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] critical frontend error', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <StateBlock
          title="Интерфейс столкнулся с ошибкой"
          message="Обновите страницу. Если ошибка повторяется, проверьте консоль браузера и состояние backend."
        />
      );
    }

    return this.props.children;
  }
}
