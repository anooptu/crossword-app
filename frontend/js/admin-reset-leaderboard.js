document.getElementById('reset-leaderboard-btn').addEventListener('click', async () => {
    const messageDiv = document.getElementById('message');
    messageDiv.style.display = 'none';

    try {
        const response = await fetch('/api/users/scores', { method: 'DELETE' });

        if (response.ok) {
            messageDiv.textContent = 'All cricket crossword scores have been reset to 0. Redirecting to dashboard...';
            messageDiv.style.display = 'block';
            messageDiv.style.color = '#007f8c';
            setTimeout(() => {
                window.location.href = '/admin/dashboard';
            }, 2000);
        } else {
            const data = await response.json();
            messageDiv.textContent = `Failed to reset cricket crossword scores: ${data.error}`;
            messageDiv.style.display = 'block';
            messageDiv.style.color = '#e33b32';
        }
    } catch (error) {
        console.error('Error resetting scores:', error);
        messageDiv.textContent = 'An error occurred while resetting cricket crossword scores.';
        messageDiv.style.display = 'block';
        messageDiv.style.color = '#e33b32';
    }
});
