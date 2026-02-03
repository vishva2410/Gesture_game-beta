import React, { Component, Suspense } from 'react';
import PropTypes from 'prop-types';
import { 
  ErrorBoundaryContext
} from '../contexts/ErrorBoundaryContext';

// ======================== ADVANCED ERROR BOUNDARY ========================
export class AdvancedErrorBoundary extends Component {
  static propTypes = {
    children: PropTypes.node,
    fallback: PropTypes.oneOfType([PropTypes.node, PropTypes.func, PropTypes.element]),
    onError: PropTypes.func,
    onReset: PropTypes.func,
    resetKeys: PropTypes.array,
    resetTimeout: PropTypes.number,
    autoReset: PropTypes.bool,
    errorFilter: PropTypes.func,
    fallbackComponent: PropTypes.elementType,
    errorLogger: PropTypes.func,
    captureAll: PropTypes.bool,
    recoveryStrategy: PropTypes.oneOf(['retry', 'refresh', 'fallback', 'ignore']),
    maxRetries: PropTypes.number,
    suspenseFallback: PropTypes.node,
    showDevInfo: PropTypes.bool,
    disableInProduction: PropTypes.bool,
  };

  static defaultProps = {
    resetTimeout: 5000,
    autoReset: false,
    captureAll: true,
    recoveryStrategy: 'retry',
    maxRetries: 3,
    showDevInfo: process.env.NODE_ENV === 'development',
    disableInProduction: false,
  };

  static contextType = ErrorBoundaryContext;

  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      lastReset: null,
      componentStack: [],
      isRecovering: false,
      errorTimestamp: null,
    };
    
    this.errorHistory = [];
    this.retryTimeout = null;
    this.resetTimeout = null;
  }

  static getDerivedStateFromError(error) {
    const errorId = Math.random().toString(36).substring(2, 9);
    return {
      hasError: true,
      error,
      errorId,
      errorTimestamp: Date.now(),
      retryCount: 0,
    };
  }

  componentDidCatch(error, errorInfo) {
    const { errorFilter, errorLogger, onError } = this.props;
    const { errorId, errorTimestamp } = this.state;
    
    // Filter errors if provided
    if (errorFilter && !errorFilter(error)) {
      throw error; // Re-throw if filtered out
    }

    // Update state with error info
    this.setState({
      errorInfo,
      componentStack: errorInfo.componentStack 
        ? errorInfo.componentStack.split('\n').slice(1) 
        : [],
    });

    // Log error to external service if provided
    if (errorLogger) {
      errorLogger(error, errorInfo, errorId);
    }

    // Call custom error handler
    if (onError) {
      onError(error, errorInfo, errorId);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.groupCollapsed(`🚨 Error Boundary [${errorId}]`);
      console.error('Error:', error);
      console.error('Error Info:', errorInfo);
      console.groupEnd();
    }

    // Store in history
    this.errorHistory.push({
      id: errorId,
      error,
      errorInfo,
      timestamp: errorTimestamp,
      componentStack: errorInfo.componentStack,
    });

    // Auto-reset logic
    if (this.props.autoReset && this.props.resetTimeout) {
      this.resetTimeout = setTimeout(() => {
        this.handleReset();
      }, this.props.resetTimeout);
    }

    // Auto-retry for recoverable errors
    if (this.isRecoverableError(error) && this.props.recoveryStrategy === 'retry') {
      this.handleRetry();
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // Reset error boundary when resetKeys change
    if (this.props.resetKeys && 
        JSON.stringify(this.props.resetKeys) !== JSON.stringify(prevProps.resetKeys)) {
      this.handleReset();
    }

    // Check if in production and disabled
    if (this.props.disableInProduction && 
        process.env.NODE_ENV === 'production' && 
        this.state.hasError) {
      this.handleReset();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) clearTimeout(this.retryTimeout);
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
  }

  isRecoverableError = (error) => {
    // Define which errors are recoverable
    const recoverableErrors = [
      'NetworkError',
      'ChunkLoadError',
      'TimeoutError',
    ];
    
    return recoverableErrors.some(type => 
      error.name?.includes(type) || 
      error.message?.includes(type)
    );
  };

  handleRetry = () => {
    const { maxRetries, recoveryStrategy } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      console.warn('Max retries reached. Switching to fallback.');
      if (recoveryStrategy === 'fallback') {
        this.setState({ hasError: true });
      }
      return;
    }

    this.setState({ isRecovering: true });

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);

    this.retryTimeout = setTimeout(() => {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
        isRecovering: false,
      }));
    }, delay);
  };

  handleReset = () => {
    const { onReset } = this.props;

    if (this.resetTimeout) clearTimeout(this.resetTimeout);
    if (this.retryTimeout) clearTimeout(this.retryTimeout);

    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: null,
      retryCount: 0,
      lastReset: Date.now(),
      componentStack: [],
      isRecovering: false,
    });

    if (onReset) {
      onReset();
    }
  };

  handleIgnore = () => {
    this.setState({ hasError: false });
  };

  handleReport = () => {
    const { error, errorInfo, errorId } = this.state;
    
    // Simulate error reporting to backend
    fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorId,
        error: error?.toString(),
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: Date.now(),
      }),
    }).catch(() => {
      console.warn('Error reporting failed');
    });
  };

  renderDevTools = () => {
    if (!this.props.showDevInfo || !this.state.error) return null;

    return (
      <div style={styles.devTools}>
        <div style={styles.devToolsHeader}>
          <h3>🚨 Development Error Details</h3>
          <button 
            onClick={() => this.setState({ showDev: false })}
            style={styles.closeButton}
          >
            ×
          </button>
        </div>
        
        <div style={styles.devSection}>
          <h4>Error: {this.state.error.toString()}</h4>
          <pre style={styles.stack}>
            {this.state.error.stack}
          </pre>
        </div>

        {this.state.componentStack.length > 0 && (
          <div style={styles.devSection}>
            <h4>Component Stack:</h4>
            <pre style={styles.stack}>
              {this.state.componentStack.join('\n')}
            </pre>
          </div>
        )}

        <div style={styles.devSection}>
          <h4>Error History ({this.errorHistory.length}):</h4>
          {this.errorHistory.map((err, idx) => (
            <div key={err.id} style={styles.errorItem}>
              <div style={styles.errorHeader}>
                <span>{idx + 1}. {err.error?.toString()}</span>
                <small>{new Date(err.timestamp).toLocaleTimeString()}</small>
              </div>
            </div>
          ))}
        </div>

        <div style={styles.devActions}>
          <button onClick={this.handleReset} style={styles.devButton}>
            Reset Boundary
          </button>
          <button onClick={() => console.log(this.errorHistory)} style={styles.devButton}>
            Log History
          </button>
          <button onClick={() => this.setState({ showDev: false })} style={styles.devButton}>
            Hide Details
          </button>
        </div>
      </div>
    );
  };

  renderFallback = () => {
    const { 
      fallback, 
      fallbackComponent: FallbackComponent,
      recoveryStrategy,
      suspenseFallback 
    } = this.props;
    const { error, errorInfo, errorId, retryCount, isRecovering } = this.state;

    if (isRecovering && suspenseFallback) {
      return suspenseFallback;
    }

    if (FallbackComponent) {
      return (
        <FallbackComponent
          error={error}
          errorInfo={errorInfo}
          errorId={errorId}
          retryCount={retryCount}
          onRetry={this.handleRetry}
          onReset={this.handleReset}
          onReport={this.handleReport}
          onIgnore={this.handleIgnore}
        />
      );
    }

    if (fallback) {
      if (typeof fallback === 'function') {
        return fallback({
          error,
          errorInfo,
          errorId,
          retryCount,
          onRetry: this.handleRetry,
          onReset: this.handleReset,
          onReport: this.handleReport,
          onIgnore: this.handleIgnore,
        });
      }
      return fallback;
    }

    return this.renderDefaultFallback();
  };

  renderDefaultFallback = () => {
    const { error, errorInfo, errorId, retryCount } = this.state;
    const isDev = process.env.NODE_ENV === 'development';

    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <div style={styles.header}>
            <div style={styles.iconContainer}>
              <svg style={styles.icon} viewBox="0 0 24 24">
                <path fill="currentColor" d="M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z" />
              </svg>
            </div>
            <div style={styles.titleContainer}>
              <h1 style={styles.title}>Oops! Something went wrong</h1>
              <p style={styles.subtitle}>
                Error ID: <code style={styles.errorId}>{errorId}</code>
              </p>
              {retryCount > 0 && (
                <p style={styles.retryInfo}>
                  Retry attempt: {retryCount} of {this.props.maxRetries}
                </p>
              )}
            </div>
          </div>

          <div style={styles.content}>
            <div style={styles.errorDetails}>
              <h3 style={styles.errorTitle}>{error?.toString()}</h3>
              
              {isDev && error?.stack && (
                <details style={styles.details}>
                  <summary style={styles.summary}>Stack Trace</summary>
                  <pre style={styles.pre}>{error.stack}</pre>
                </details>
              )}

              {isDev && errorInfo?.componentStack && (
                <details style={styles.details}>
                  <summary style={styles.summary}>Component Stack</summary>
                  <pre style={styles.pre}>{errorInfo.componentStack}</pre>
                </details>
              )}
            </div>

            <div style={styles.actions}>
              {this.isRecoverableError(error) && (
                <button
                  onClick={this.handleRetry}
                  disabled={this.state.isRecovering}
                  style={{ ...styles.button, ...styles.primaryButton }}
                >
                  {this.state.isRecovering ? (
                    <>
                      <span style={styles.spinner}></span>
                      Retrying...
                    </>
                  ) : (
                    `Retry (${retryCount + 1}/${this.props.maxRetries})`
                  )}
                </button>
              )}

              <button
                onClick={this.handleReset}
                style={{ ...styles.button, ...styles.secondaryButton }}
              >
                Reset Application
              </button>

              <button
                onClick={this.handleReport}
                style={{ ...styles.button, ...styles.outlineButton }}
              >
                Report Error
              </button>

              {isDev && (
                <button
                  onClick={this.handleIgnore}
                  style={{ ...styles.button, ...styles.ghostButton }}
                >
                  Continue Anyway
                </button>
              )}

              <a
                href="/"
                style={{ ...styles.button, ...styles.linkButton }}
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = '/';
                }}
              >
                Go to Homepage
              </a>
            </div>

            {isDev && (
              <div style={styles.devNote}>
                <p>
                  <strong>Development Mode:</strong> Error details are shown here.
                  In production, users will see a simpler message.
                </p>
              </div>
            )}
          </div>
        </div>

        {isDev && this.renderDevTools()}
      </div>
    );
  };

  render() {
    const { hasError, isRecovering } = this.state;
    const { children, suspenseFallback, captureAll } = this.props;
    
    // Check if we should disable in production
    if (this.props.disableInProduction && 
        process.env.NODE_ENV === 'production' && 
        hasError) {
      return null;
    }

    if (hasError && !isRecovering) {
      return this.renderFallback();
    }

    if (isRecovering && suspenseFallback) {
      return suspenseFallback;
    }

    // Wrap children in Suspense if provided
    if (suspenseFallback) {
      return (
        <Suspense fallback={suspenseFallback}>
          {children}
        </Suspense>
      );
    }

    return children;
  }
}

// ======================== HOOKS ========================
export const useErrorBoundary = () => {
  const context = React.useContext(ErrorBoundaryContext);
  if (!context) {
    throw new Error('useErrorBoundary must be used within ErrorBoundaryProvider');
  }
  return context;
};

export const useErrorHandler = () => {
  const { showError } = useErrorBoundary();
  return showError;
};

export const withErrorBoundary = (WrappedComponent, options = {}) => {
  return function WithErrorBoundaryWrapper(props) {
    return (
      <AdvancedErrorBoundary {...options}>
        <WrappedComponent {...props} />
      </AdvancedErrorBoundary>
    );
  };
};

// ======================== ERROR BOUNDARY GROUP ========================
export const ErrorBoundaryGroup = ({ children, fallback, onGroupError }) => {
  const [groupErrors, setGroupErrors] = React.useState([]);
  
  const handleGroupError = (error, errorInfo) => {
    setGroupErrors(prev => [...prev, { error, errorInfo, timestamp: Date.now() }]);
    if (onGroupError) {
      onGroupError(error, errorInfo);
    }
  };
  
  const resetGroup = () => {
    setGroupErrors([]);
  };
  
  if (groupErrors.length > 0 && fallback) {
    if (typeof fallback === 'function') {
      return fallback({ errors: groupErrors, resetGroup });
    }
    return fallback;
  }
  
  return (
    <ErrorBoundaryContext.Provider value={{ showError: handleGroupError, errors: groupErrors }}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
};

// ======================== ERROR REPORTER ========================
export const ErrorReporter = ({ serviceUrl, appId, userId }) => {
  const reportError = React.useCallback((error, errorInfo, errorId) => {
    const errorData = {
      errorId,
      appId,
      userId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: errorInfo ? {
        componentStack: errorInfo.componentStack,
      } : null,
      url: window.location.href,
      userAgent: navigator.userAgent,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV,
      version: process.env.REACT_APP_VERSION || '1.0.0',
    };
    
    // Send to error tracking service
    if (serviceUrl) {
      fetch(serviceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
        keepalive: true,
      }).catch(console.warn);
    }
    
    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error reported:', errorData);
    }
  }, [serviceUrl, appId, userId]);
  
  return reportError;
};

// ======================== CUSTOM FALLBACK COMPONENTS ========================
export const MinimalFallback = ({ error, onRetry }) => (
  <div style={styles.minimalContainer}>
    <h2>Something went wrong</h2>
    <p>{error?.message || 'An unexpected error occurred'}</p>
    <button onClick={onRetry} style={styles.minimalButton}>
      Try Again
    </button>
  </div>
);

export const AnimatedFallback = ({ error, errorId, onRetry }) => {
  const [show, setShow] = React.useState(false);
  
  React.useEffect(() => {
    const timer = setTimeout(() => setShow(true), 100);
    return () => clearTimeout(timer);
  }, []);
  
  return (
    <div style={{ 
      ...styles.animatedContainer,
      opacity: show ? 1 : 0,
      transform: show ? 'translateY(0)' : 'translateY(20px)',
      transition: 'all 0.3s ease'
    }}>
      <div style={styles.animatedIcon}>⚠️</div>
      <h2>Oops! Something went wrong</h2>
      <p>We're working on fixing the issue.</p>
      <p style={styles.errorCode}>Error: {errorId}</p>
      <button onClick={onRetry} style={styles.animatedButton}>
        Try Again
      </button>
    </div>
  );
};

// ======================== STYLES ========================
const styles = {
  container: {
    padding: '40px 20px',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#333',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    maxWidth: '800px',
    width: '100%',
    overflow: 'hidden',
    animation: 'slideIn 0.3s ease',
  },
  header: {
    background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%)',
    color: 'white',
    padding: '30px',
    display: 'flex',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: '20px',
  },
  icon: {
    width: '60px',
    height: '60px',
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))',
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: '700',
  },
  subtitle: {
    margin: '5px 0 0 0',
    opacity: 0.9,
    fontSize: '14px',
  },
  errorId: {
    background: 'rgba(255,255,255,0.2)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  retryInfo: {
    margin: '5px 0 0 0',
    fontSize: '13px',
    opacity: 0.8,
  },
  content: {
    padding: '30px',
  },
  errorDetails: {
    marginBottom: '30px',
  },
  errorTitle: {
    color: '#e74c3c',
    margin: '0 0 20px 0',
    fontSize: '18px',
    fontWeight: '600',
  },
  details: {
    marginBottom: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  summary: {
    padding: '12px 20px',
    background: '#f8f9fa',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px',
    color: '#495057',
    border: 'none',
    outline: 'none',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pre: {
    margin: 0,
    padding: '20px',
    background: '#1a1a1a',
    color: '#f8f8f8',
    fontSize: '12px',
    lineHeight: 1.5,
    overflow: 'auto',
    maxHeight: '300px',
    fontFamily: 'Monaco, Consolas, monospace',
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginBottom: '20px',
  },
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    textDecoration: 'none',
  },
  primaryButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
  },
  secondaryButton: {
    background: '#e9ecef',
    color: '#495057',
  },
  outlineButton: {
    background: 'transparent',
    color: '#667eea',
    border: '2px solid #667eea',
  },
  ghostButton: {
    background: 'transparent',
    color: '#6c757d',
    border: '1px solid #dee2e6',
  },
  linkButton: {
    background: 'transparent',
    color: '#20c997',
    textDecoration: 'underline',
  },
  spinner: {
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  devNote: {
    padding: '15px',
    background: '#e3f2fd',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#1976d2',
    marginTop: '20px',
  },
  devTools: {
    marginTop: '30px',
    background: '#1a1a1a',
    color: '#f8f8f8',
    borderRadius: '12px',
    overflow: 'hidden',
    maxWidth: '800px',
    width: '100%',
  },
  devToolsHeader: {
    padding: '15px 20px',
    background: '#2d2d2d',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #404040',
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    color: '#f8f8f8',
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '30px',
    height: '30px',
  },
  devSection: {
    padding: '20px',
    borderBottom: '1px solid #404040',
  },
  stack: {
    margin: '10px 0 0 0',
    padding: '15px',
    background: '#000',
    borderRadius: '6px',
    fontSize: '12px',
    lineHeight: 1.4,
    overflow: 'auto',
    maxHeight: '200px',
  },
  errorItem: {
    marginBottom: '10px',
    padding: '10px',
    background: '#2d2d2d',
    borderRadius: '6px',
  },
  errorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  devActions: {
    padding: '15px 20px',
    display: 'flex',
    gap: '10px',
  },
  devButton: {
    padding: '8px 16px',
    background: '#667eea',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  minimalContainer: {
    padding: '40px',
    textAlign: 'center',
  },
  minimalButton: {
    padding: '10px 20px',
    background: '#007bff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  animatedContainer: {
    padding: '40px',
    textAlign: 'center',
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
  },
  animatedIcon: {
    fontSize: '60px',
    marginBottom: '20px',
  },
  errorCode: {
    fontFamily: 'monospace',
    background: '#f8f9fa',
    padding: '5px 10px',
    borderRadius: '4px',
    display: 'inline-block',
    margin: '10px 0',
  },
  animatedButton: {
    padding: '12px 30px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '600',
    marginTop: '20px',
  },
};

// ======================== EXPORTS ========================
export default AdvancedErrorBoundary;
export { AdvancedErrorBoundary as ErrorBoundary };
