import Home from "./views/Home.js";
import Match from "./views/Match.js";
import ScoutEntry from "./views/ScoutEntry.js";

export const navigateTo = url => {
    history.pushState(null, null, url);
    router();
};

export const router = async () => {
    const routes = [
        { path: '/scouting', view: Home() },
        { path: '/scouting/match', view: Match() },
        { path: '/scouting/add', view: ScoutEntry() },
    ];

    const potentialMatches = routes.map(route => ({
        route,
        isMatch: location.pathname === route.path || location.pathname === route.path + '/'
    }));

    let match = potentialMatches.find(potentialMatch => potentialMatch.isMatch);

    if (!match) {
        match = { route: routes[0], isMatch: true };
    }

    document.getElementById('app').innerHTML = await match.route.view;
};