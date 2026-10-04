function ErrorState({ message, onRetry }) {
  return (
    <div className="error-state">
      <div className="error-state__icon">!</div>
      <div className="error-state__message">{message || 'Something went wrong.'}</div>
      {onRetry && (
        <button className="btn btn--primary" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}

export default ErrorState;