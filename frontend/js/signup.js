document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const messageDiv = document.getElementById('message');

    const response = await fetch('/api/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    });

    if (response.ok) {
        messageDiv.textContent = 'Participant account created. Redirecting to login...';
        messageDiv.style.display = 'block';
        messageDiv.style.color = '#007f8c';
        setTimeout(() => {
            window.location.href = '/login';
        }, 2000);
    } else {
        const data = await response.json();
        messageDiv.textContent = `Registration failed: ${data.error}`;
        messageDiv.style.display = 'block';
        messageDiv.style.color = '#e33b32';
    }
});
