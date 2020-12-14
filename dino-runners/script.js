
// Initialize Cloud Firestore through Firebase
var firebaseConfig = {
    apiKey: "AIzaSyCHa5ByDbjjM3ApCaBPSfyCFH--iKQiw08",
    authDomain: "dino-runners.firebaseapp.com",
    projectId: "dino-runners",
    storageBucket: "dino-runners.appspot.com",
    messagingSenderId: "639399018683",
    appId: "1:639399018683:web:f7edef2314e54c8ea7a99e"
};
// Initialize Firebase
firebase.initializeApp(firebaseConfig);

var db = firebase.firestore();

const START_BUTTON_TEXT = "This dino is running!";
const STOP_BUTTON_TEXT = "This dino needs a breather!";

function saveOutTrip(dino, tripStatus) {
    let time = tripStatus["start_time"].toMillis();
    db.collection("trip_histories").doc(dino).set({
        [time]: tripStatus["total_distance"]
    }, { merge: true });
}

function distance(lat1, lon1, lat2, lon2, unit) {
    if ((lat1 == lat2) && (lon1 == lon2)) {
        return 0;
    }
    else {
        var radlat1 = Math.PI * lat1 / 180;
        var radlat2 = Math.PI * lat2 / 180;
        var theta = lon1 - lon2;
        var radtheta = Math.PI * theta / 180;
        var dist = Math.sin(radlat1) * Math.sin(radlat2) + Math.cos(radlat1) * Math.cos(radlat2) * Math.cos(radtheta);
        if (dist > 1) {
            dist = 1;
        }
        dist = Math.acos(dist);
        dist = dist * 180 / Math.PI;
        dist = dist * 60 * 1.1515;
        if (unit == "K") { dist = dist * 1.609344 }
        if (unit == "N") { dist = dist * 0.8684 }
        return dist;
    }
}

function calculateDistances(dino) {
    return function () {
        // Get the distance travelled so far, and the last coordinate
        var getOptions = {
            source: 'default'
        };
        var tripRef = db.collection("current_trip").doc(dino);
        tripRef.get(getOptions).then(function (doc) {
            tripStatus = doc.data();
            // Calculate the distance from the last coordinate to the current
            // coordinate
            navigator.geolocation.getCurrentPosition(function (loc) {
                let prev_lat = tripStatus['last_lat'];
                let prev_long = tripStatus['last_long'];
                let cur_lat = loc.coords.latitude;
                let cur_long = loc.coords.longitude;
                let prev_dist = tripStatus['total_distance'];
                try {
                    // Update the distance travelled and the last coordinate
                    let d = distance(prev_lat, prev_long, cur_lat, cur_long, 'M');
                    tripRef.set({
                        total_distance: prev_dist + d,
                        last_lat: cur_lat,
                        last_long: cur_long,
                    }, { merge: true });
                } catch {
                    tripRef.set({
                        total_distance: prev_dist,
                        last_lat: cur_lat,
                        last_long: cur_long,
                    }, { merge: true });
                }
            });
        });
    }
}

function onButtonClick(dino) {
    // First validate that the text on the button matches the status of our
    // db
    let btn = document.getElementById(dino + "-btn");
    let btnIsActive = btn.innerHTML === STOP_BUTTON_TEXT;
    var getOptions = {
        source: 'default'
    };
    var tripRef = db.collection("current_trip").doc(dino);
    tripRef.get(getOptions).then(function (doc) {
        tripStatus = doc.data();
        if (tripStatus["is_active"] !== btnIsActive) {
            alert("Can't edit trip. Retry later.")
            return;
        }
        /* If we are currently INactive, we need to:
            (Going from Inactive -> Active)
            1. Update the table with our new status
            2. Change the text on the button to STOP
            3. Set loop to update coordinate every 10 seconds
        */
        if (!tripStatus["is_active"]) {
            navigator.geolocation.getCurrentPosition(function (loc) {
                tripRef.set({
                    total_distance: 0.0,
                    last_lat: loc.coords.latitude,
                    last_long: loc.coords.longitude,
                    is_active: true,
                    start_time: firebase.firestore.Timestamp.now()
                }, { merge: true });
                btn.innerHTML = STOP_BUTTON_TEXT;
                setInterval(calculateDistances(dino), 10000);
            });
        }

        /* If we are currently active, we need to:
            (Going from Active -> Inactive)
            1. Save out our old trip
            2. Update the table with our new status
            3. Change the text on the button
        */
        else {
            saveOutTrip(dino, tripStatus);
            tripRef.set({
                is_active: false
            }, { merge: true });
            btn.innerHTML = START_BUTTON_TEXT;
        }
    }).catch(function (error) {
        console.log("Error getting document:", error);
    });
}

function updateDinoDistance(dino) {
    return function (doc) {
        tripStatus = doc.data();
        document.getElementById(dino + "-dist").innerHTML = tripStatus["total_distance"].toFixed(2) + " mi";
        document.getElementById(dino + "-btn").innerHTML = tripStatus["is_active"] ? STOP_BUTTON_TEXT : START_BUTTON_TEXT;
    }
}

function initializeListeners() {
    // Add listener for the dino's distances
    for (dino of ["ishaan", "francesca"]) {
        db.collection("current_trip").doc(dino)
            .onSnapshot(updateDinoDistance(dino));
    }
}

function deleteRow(dino, time) {
    db.collection("trip_histories").doc(dino).update({
        [time]: firebase.firestore.FieldValue.delete()
    }).then(function(error) {
        location.reload();
    });
}

function fillInTables() {
    // T-Rex steps are 12-15 feet
    let trex_steps_per_mile = 5280 / 15;
    // Sauropod steps are 9 feet
    let sauropod_steps_per_mile = 5280 / 9;

    for (let dino of ['ishaan', 'francesca']) {
        var tripRef = db.collection("trip_histories").doc(dino);
        let table = document.getElementById(dino + '-table');
        tripRef.get().then(function (doc) {
            var options = {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            };
            histories = doc.data();
            var sorted_times = Object.keys(histories).sort()
            for (time of sorted_times) {
                let dist = histories[time];
                let date = new Date(Number(time));
                let date_str = date.toLocaleDateString("en-US", options);
                let row = table.insertRow(1);
                let date_cell = row.insertCell();
                let dist_cell = row.insertCell();
                let step_cell = row.insertCell();
                date_cell.innerHTML = date_str;
                dist_cell.innerHTML = dist.toFixed(2) + " mi";
                step_cell.innerHTML = (
                    dino === "ishaan" ? 
                    dist * trex_steps_per_mile : 
                    dist * sauropod_steps_per_mile
                    ).toFixed(0) + `<span class="killer"><a href="javascript:deleteRow('${dino}', ${time})">🗑</a></span>`;
            }
        });
    }
}
