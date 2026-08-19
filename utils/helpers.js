// Shared FUTRIX Visual and Utility Helpers
window.FUTRIX_HELPERS = {
  // Safe Markdown parser translating bold, italic, code tags, and newlines
  formatMarkdown(text) {
    if (!text) return '';
    let html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Bold highlights (**text**)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Italic tags (*text*)
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Code tags (`code`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Newline tags
    html = html.replace(/\n/g, '<br>');
    return html;
  },

  // Safe time of day context analyzer
  getTimeContext() {
    const hr = new Date().getHours();
    if (hr >= 5 && hr < 12) return 'Morning';
    if (hr >= 12 && hr < 17) return 'Afternoon';
    if (hr >= 17 && hr < 21) return 'Evening';
    return 'Night';
  },

  // Predictable date formatters
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
};
