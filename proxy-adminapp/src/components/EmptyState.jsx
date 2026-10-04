function EmptyState({ message }) {
  return (
    <div className="empty-state">
      {message || 'No data to display.'}
    </div>
  );
}

export default EmptyState;