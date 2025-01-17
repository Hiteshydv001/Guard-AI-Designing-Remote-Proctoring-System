import React, { useEffect } from "react";
import { loginUser, logoutUser } from "./components/Auth";
import { trackUserActivity } from "./components/Inactivity";
import { showSessionSummary } from "./components/Summary";

const App = () => {
    useEffect(() => {
        trackUserActivity();
    }, []);

    return (
        <div>
            <h1>Guard AI - Remote Proctoring System</h1>
            <button onClick={() => loginUser("TestUser")}>Login</button>
            <button onClick={logoutUser}>Logout</button>
            <button onClick={showSessionSummary}>Show Summary</button>
        </div>
    );
};

export default App;
