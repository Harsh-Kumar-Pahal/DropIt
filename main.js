// Firebase imports
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, set, push, onValue, update, query, orderByChild, equalTo } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

// Firebase Configuration (Replace with your actual config)
const firebaseConfig = {
    apiKey: "AIzaSyDB_ylrW7hartjCjSAqjjZjUoNSrSX7Et4",
    authDomain: "blogs-a7325.firebaseapp.com",
    databaseURL: "https://blogs-a7325-default-rtdb.firebaseio.com",
    projectId: "blogs-a7325",
    storageBucket: "blogs-a7325.appspot.com",
    messagingSenderId: "868013133674",
    appId: "1:868013133674:web:8ceaa7dfa63ee0d2a0df13",
    measurementId: "G-RJX09FKMMY"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Show Register Form
window.showRegisterForm = function() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
}

// Show Login Form
window.showLoginForm = function() {
    document.getElementById('registerForm').classList.add('hidden');
    document.getElementById('loginForm').classList.remove('hidden');
}

// User Registration
window.register = function() {
    const name = document.getElementById('registerNameInput').value;
    const email = document.getElementById('registerEmailInput').value;
    const password = document.getElementById('registerPasswordInput').value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            // Store additional user info in Realtime Database
            set(ref(database, 'AirShare/' + user.uid), {
                name: name,
                email: email,
                online: true
            });
            switchToFileSharing(user);
        })
        .catch((error) => alert(error.message));
}

// User Login
window.login = function() {
    const email = document.getElementById('loginEmailInput').value;
    const password = document.getElementById('loginPasswordInput').value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            // Update online status
            set(ref(database, 'AirShare/' + user.uid + '/online'), true);
            switchToFileSharing(user);
        })
        .catch((error) => alert(error.message));
}

// Switch to File Sharing Interface
function switchToFileSharing(user) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('fileShareSection').classList.remove('hidden');
    document.getElementById('userWelcome').innerText = `Welcome, ${user.email}`;
    setupFileListeners(user);
    checkReceiverStatus();
}

// Check Receiver Online Status
function checkReceiverStatus() {
    const receiverEmailInput = document.getElementById('receiverEmail');
    const receiverStatusSpan = document.getElementById('receiverStatus');

    receiverEmailInput.addEventListener('change', () => {
        const AirShareRef = ref(database, 'AirShare');
        onValue(AirShareRef, (snapshot) => {
            const AirShare = snapshot.val();
            const receiver = Object.values(AirShare).find(
                user => user.email === receiverEmailInput.value
            );

            if (receiver) {
                receiverStatusSpan.textContent = receiver.online ? 'Online' : 'Offline';
                receiverStatusSpan.style.color = receiver.online ? 'green' : 'red';
            } else {
                receiverStatusSpan.textContent = 'User not found';
                receiverStatusSpan.style.color = 'gray';
            }
        }, { onlyOnce: true });
    });
}

// Send File Function
window.sendFile = function() {
    const fileInput = document.getElementById('fileInput');
    const receiverEmail = document.getElementById('receiverEmail').value;
    const file = fileInput.files[0];

    if (!file || !receiverEmail) {
        alert('Please select a file and enter receiver email');
        return;
    }

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = function(event) {
        // Find receiver's UID by email
        const AirShareRef = ref(database, 'AirShare');
        
        onValue(AirShareRef, (snapshot) => {
            const AirShare = snapshot.val();
            const receiverUid = Object.keys(AirShare).find(
                uid => AirShare[uid].email === receiverEmail
            );

            if (receiverUid && AirShare[receiverUid].online) {
                const fileRef = push(ref(database, `files/${receiverUid}`));
                set(fileRef, {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: event.target.result,
                    sender: auth.currentUser.email,
                    status: 'pending'
                });
                alert('File sent successfully!');
            } else {
                alert('Receiver not found or offline');
            }
        }, { onlyOnce: true });
    };
    reader.readAsDataURL(file);
}

// Setup File Listeners
function setupFileListeners(user) {
    onValue(ref(database, `files/${user.uid}`), (snapshot) => {
        snapshot.forEach((childSnapshot) => {
            const fileData = childSnapshot.val();
            if (fileData.status === 'pending') {
                const confirmDownload = confirm(`${fileData.sender} wants to send you ${fileData.name}. Accept?`);
                
                if (confirmDownload) {
                    const link = document.createElement('a');
                    link.href = fileData.data;
                    link.download = fileData.name;
                    link.click();
                    
                    // Update file status
                    update(childSnapshot.ref, { status: 'accepted' });
                } else {
                    update(childSnapshot.ref, { status: 'rejected' });
                }
            }
        });
    });
}

// Handle user's online/offline status
onAuthStateChanged(auth, (user) => {
    if (user) {
        const userRef = ref(database, `AirShare/${user.uid}/online`);
        
        // Set online status
        set(userRef, true);
        
        // Handle disconnection
        window.addEventListener('beforeunload', () => {
            set(userRef, false);
        });
    }
});