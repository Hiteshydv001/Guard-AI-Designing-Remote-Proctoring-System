document.addEventListener('DOMContentLoaded', function() {
    const liveDataContainer = document.getElementById('live-data');

    // Simulating live updates
    setInterval(() => {
        fetch('/api/live-proctoring') // Ensure this API exists
            .then(response => response.json())
            .then(data => {
                liveDataContainer.innerHTML = `
                    <p>Active Exams: ${data.active_exams}</p>
                    <p>Alerts: ${data.alerts}</p>
                `;
            })
            .catch(error => console.error('Error fetching live data:', error));
    }, 5000); // Refresh every 5 seconds
});
