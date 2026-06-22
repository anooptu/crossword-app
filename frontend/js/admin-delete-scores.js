document.getElementById('delete-scores-btn').addEventListener('click', async () => {
    const confirmed = window.confirm('Delete all cricket crossword logs, leaderboard scores, and attempt history? This cannot be undone.');
    if (!confirmed) {
        return;
    }

    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'none'; // Hide previous messages

    try {
        const response = await fetch('/api/scores', { method: 'DELETE' });

        if (response.ok) {
            messageDiv.textContent = 'All cricket crossword logs, scores, and attempts have been deleted. Redirecting to dashboard...';
            messageDiv.style.display = 'block';
            messageDiv.style.color = '#007f8c';
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 2000);
        } else {
            // Log the full error response
            console.error('Failed to delete scores. Response status:', response.status);
            const data = await response.json();
            console.error('Server error details:', data);

            messageDiv.textContent = `Failed to delete scores: ${data.error} (Status: ${response.status})`
            messageDiv.style.display = 'block';
            messageDiv.style.color = '#e33b32';
        }
    } catch (error) {
        console.error('A network or other error occurred:', error);
        messageDiv.textContent = 'A network error occurred while trying to delete scores.';
        messageDiv.style.display = 'block';
        messageDiv.style.color = '#e33b32';
    }
});
