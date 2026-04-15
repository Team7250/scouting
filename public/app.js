import { router, navigateTo } from "./router.js";
import { auth, onAuthStateChanged, signOut } from "./firebase.js";

export { auth };

function init() {
    setupNavigation();
    router();

    // Keep a signed-in user pill in the navbar if present
    onAuthStateChanged(auth, (user) => {
        let pill = document.getElementById("navbar-user-pill");
        if (user) {
            if (!pill) {
                pill = document.createElement("span");
                pill.id = "navbar-user-pill";
                pill.className = "auth-user-pill";
                pill.style.cursor = "pointer";
                pill.title = "Click to sign out";
                pill.addEventListener("click", () => signOut(auth));
                document.querySelector(".navbar").appendChild(pill);
            }
            pill.textContent = user.displayName || user.email;
        } else {
            pill?.remove();
        }
    });
}

function setupNavigation() {
    document.body.addEventListener('click', (e) => {
        const link = e.target.closest('[data-link]');
        if (link) {
            e.preventDefault();
            navigateTo(link.href);
        }
    });

    window.addEventListener('popstate', router);
}

document.addEventListener('DOMContentLoaded', init);