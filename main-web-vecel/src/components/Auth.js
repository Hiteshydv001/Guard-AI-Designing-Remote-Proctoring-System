const loginUser = (user) => {
    const loginTime = new Date().toISOString();
    localStorage.setItem("loginTime", loginTime);
    console.log("User logged in at:", loginTime);
};

const logoutUser = () => {
    const logoutTime = new Date().toISOString();
    localStorage.setItem("logoutTime", logoutTime);
    console.log("User logged out at:", logoutTime);
};

export { loginUser, logoutUser };
