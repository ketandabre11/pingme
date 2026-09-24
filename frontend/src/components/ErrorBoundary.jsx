import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          color: 'var(--text-primary, #f1f5f9)',
          padding: '2rem',
          textAlign: 'center',
          background: 'var(--bg-primary, #0f172a)'
        }}>
          <div style={{
            background: 'var(--bg-secondary, #1e293b)',
            padding: '2rem',
            borderRadius: '16px',
            border: '1px solid var(--border-color, #334155)',
            maxWidth: '480px',
            width: '100%',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
          }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: '600', marginBottom: '0.75rem', color: '#f87171' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button 
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                padding: '0.75rem 1.75rem',
                backgroundColor: 'var(--accent-primary, #3b82f6)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Reload PingMe
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
