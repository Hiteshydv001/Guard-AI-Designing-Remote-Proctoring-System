let inactivityTimer;

const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        alert("You've been inactive for too long!");
    }, 10 * 60 * 1000); // 10 minutes
};

const trackUserActivity = () => {
    window.onload = resetTimer;
    window.onmousemove = resetTimer;
    window.onkeypress = resetTimer;
    window.onclick = resetTimer;
};

export { trackUserActivity };
