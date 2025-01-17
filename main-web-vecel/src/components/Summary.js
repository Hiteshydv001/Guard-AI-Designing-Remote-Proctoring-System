const showSessionSummary = () => {
    const loginTime = localStorage.getItem("loginTime");
    const logoutTime = localStorage.getItem("logoutTime");

    if (loginTime && logoutTime) {
        alert(`Session Summary:
        - Login Time: ${loginTime}
        - Logout Time: ${logoutTime}`);
    } else {
        alert("Session data missing!");
    }
};

export { showSessionSummary };
