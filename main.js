import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
        import { getDatabase, ref,get, set, push, onValue, update, remove } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

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

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const database = getDatabase(app);

        const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

        // Update the showSection function to handle auth section visibility
function showSection(sectionId) {
    const sections = ['authSection', 'fileShareSection', 'loginForm', 'registerForm'];
    sections.forEach(id => {
        document.getElementById(id).classList.add('hidden');
    });
    
    // Show the auth section if showing login or register form
    if (sectionId === 'loginForm' || sectionId === 'registerForm') {
        document.getElementById('authSection').classList.remove('hidden');
    }
    
    document.getElementById(sectionId).classList.remove('hidden');
}

        // Authentication Functions
        window.showRegisterForm = () => showSection('registerForm');
        window.showLoginForm = () => showSection('loginForm');

        window.register = function() {
            const name = document.getElementById('registerNameInput').value;
            const email = document.getElementById('registerEmailInput').value;
            const password = document.getElementById('registerPasswordInput').value;

            createUserWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    set(ref(database, 'AirShare/' + user.uid), {
                        name: name,
                        email: email,
                        online: true
                    });
                    switchToFileSharing(user);
                })
                .catch((error) => {
                    document.getElementById('registerError').textContent = error.message;
                });
        }

        window.login = function() {
            const email = document.getElementById('loginEmailInput').value;
            const password = document.getElementById('loginPasswordInput').value;

            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    set(ref(database, 'AirShare/' + user.uid + '/online'), true);
                    switchToFileSharing(user);
                })
                .catch((error) => {
                    document.getElementById('loginError').textContent = error.message;
                });
        }

        window.logout = function() {
    const user = auth.currentUser;
    if (user) {
        set(ref(database, `AirShare/${user.uid}/online`), false)
            .then(() => {
                signOut(auth)
                    .then(() => {
                        // Reset UI state
                        showSection('loginForm');
                        clearFileList();
                        // Clear any input fields
                        document.getElementById('loginEmailInput').value = '';
                        document.getElementById('loginPasswordInput').value = '';
                        document.getElementById('registerEmailInput').value = '';
                        document.getElementById('registerPasswordInput').value = '';
                        document.getElementById('registerNameInput').value = '';
                        // Clear any error messages
                        document.getElementById('loginError').textContent = '';
                        document.getElementById('registerError').textContent = '';
                        // Show the auth section
                        document.getElementById('authSection').classList.remove('hidden');
                    })
                    .catch((error) => {
                        console.error('Error signing out:', error);
                        showToast('Error signing out: ' + error.message, 'error');
                    });
            })
            .catch((error) => {
                console.error('Error updating online status:', error);
                showToast('Error updating status: ' + error.message, 'error');
            });
    }
}

        function switchToFileSharing(user) {
            showSection('fileShareSection');
            document.getElementById('userWelcome').innerText = `Welcome, ${user.email}`;
            setupFileListeners(user);
            checkReceiverStatus();
        }

        function updateProgressBar(progress) {
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            progressBar.style.width = `${progress}%`;
            progressText.textContent = `${progress.toFixed(1)}%`;
        }

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
                        receiverStatusSpan.className = receiver.online 
                            ? 'self-center text-green-500 font-bold px-2 bg-green-50'  
                            : ' self-center text-red-500 font-bold px-2 bg-red-50';
                    } else {
                        receiverStatusSpan.textContent = 'Not found';
                        receiverStatusSpan.className = 'self-center px-2 bg-gray-100 text-gray-500 font-bold';
                    }
                }, { onlyOnce: true });
            });
        }

        // Split file into chunks
        function* generateChunks(file) {
            const fileSize = file.size;
            let offset = 0;
            
            while (offset < fileSize) {
                const chunk = file.slice(offset, offset + CHUNK_SIZE);
                offset += CHUNK_SIZE;
                yield chunk;
            }
        }

        // Convert chunk to base64
        function chunkToBase64(chunk) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(chunk);
            });
        }

        window.sendFile = async function() {
            const fileInput = document.getElementById('fileInput');
            const receiverEmail = document.getElementById('receiverEmail').value;
            const file = fileInput.files[0];
            const sendButton = document.getElementById('sendButton');

            if (!file || !receiverEmail) {
                alert('Please select a file and enter receiver email');
                return;
            }

            try {
                sendButton.disabled = true;
                document.getElementById('progressContainer').classList.remove('hidden');

                // Find receiver
                const AirShareRef = ref(database, 'AirShare');
                const snapshot = await new Promise(resolve => {
                    onValue(AirShareRef, resolve, { onlyOnce: true });
                });
                
                const AirShare = snapshot.val();
                const receiverUid = Object.keys(AirShare).find(
                    uid => AirShare[uid].email === receiverEmail
                );

                if (!receiverUid || !AirShare[receiverUid].online) {
                    alert('Receiver not found or offline');
                    sendButton.disabled = false;
                    document.getElementById('progressContainer').classList.add('hidden');
                    return;
                }

                // Create file transfer record
                const fileRef = push(ref(database, `files/${receiverUid}`));
                const fileId = fileRef.key;
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

                // Initialize file transfer
                await set(fileRef, {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    sender: auth.currentUser.email,
                    status: 'pending',
                    totalChunks: totalChunks,
                    receivedChunks: 0
                });

                // Send chunks
                let chunkIndex = 0;
                for (const chunk of generateChunks(file)) {
                    const base64Chunk = await chunkToBase64(chunk);
                    const chunkRef = ref(database, `fileChunks/${receiverUid}/${fileId}/${chunkIndex}`);
                    await set(chunkRef, { data: base64Chunk });
                    
                    chunkIndex++;
                    const progress = (chunkIndex / totalChunks) * 100;
                    updateProgressBar(progress);
                }

                alert('File sent successfully!');
                fileInput.value = '';
                
            } catch (error) {
                console.error('Error sending file:', error);
                alert('Error sending file: ' + error.message);
            } finally {
                sendButton.disabled = false;
                document.getElementById('progressContainer').classList.add('hidden');
                updateProgressBar(0);
            }
        }

        function setupFileListeners(user) {
            const fileListContainer = document.getElementById('incomingFiles');
            
            onValue(ref(database, `files/${user.uid}`), async (snapshot) => {
                fileListContainer.innerHTML = '<h3 class="text-xl font-bold mb-3">Incoming Files</h3>';
                
                snapshot.forEach((childSnapshot) => {
                    const fileKey = childSnapshot.key;
                    const fileData = childSnapshot.val();
                    
                    if (fileData.status === 'pending') {
                        const fileElement = document.createElement('div');
                        fileElement.className = 'bg-gray-100 p-3 rounded mb-2';
                        fileElement.innerHTML = `
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-bold">${fileData.sender} wants to send: ${fileData.name}</p>
                                    <p>Type: ${fileData.type}, Size: ${(fileData.size / (1024 * 1024)).toFixed(2)} MB</p>
                                </div>
                                <div>
                                    <button onclick="acceptFile('${fileKey}')" class="bg-green-500 text-white px-3 py-1 rounded mr-2">Accept</button>
                                    <button onclick="rejectFile('${fileKey}')" class="bg-red-500 text-white px-3 py-1 rounded">Reject</button>
                                </div>
                            </div>
                            <div id="progress-${fileKey}" class="hidden mt-2">
                                <div class="w-full bg-gray-200 rounded-full h-2.5">
                                    <div class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                                </div>
                                <p class="text-sm text-gray-600 mt-1">Downloading: 0%</p>
                            </div>
                        `;
                        fileListContainer.appendChild(fileElement);
                    }
                });
            });
        }

        window.acceptFile = async function(fileKey) {
    const user = auth.currentUser;
    const fileRef = ref(database, `files/${user.uid}/${fileKey}`);
    const fileData = (await get(fileRef)).val();
    
    if (!fileData) {
        showToast('File data not found', 'error');
        return;
    }

    const progressElement = document.getElementById(`progress-${fileKey}`);
    progressElement.classList.remove('hidden');
    
    try {
        // Download chunks
        const binaryChunks = [];
        for (let i = 0; i < fileData.totalChunks; i++) {
            const chunkRef = ref(database, `fileChunks/${user.uid}/${fileKey}/${i}`);
            const chunkSnapshot = await get(chunkRef);
            const chunk = chunkSnapshot.val();
            
            if (chunk && chunk.data) {
                // Extract the base64 data after the data URL prefix
                const base64Data = chunk.data.split(',')[1];
                // Convert base64 to binary
                const binaryString = atob(base64Data);
                // Convert binary string to Uint8Array
                const bytes = new Uint8Array(binaryString.length);
                for (let j = 0; j < binaryString.length; j++) {
                    bytes[j] = binaryString.charCodeAt(j);
                }
                binaryChunks.push(bytes);
                
                // Update progress
                const progress = ((i + 1) / fileData.totalChunks) * 100;
                const progressBar = progressElement.querySelector('.bg-blue-600');
                const progressText = progressElement.querySelector('p');
                progressBar.style.width = `${progress}%`;
                progressText.textContent = `Downloading: ${progress.toFixed(1)}%`;
            }
        }

        // Combine all chunks into a single Uint8Array
        const totalLength = binaryChunks.reduce((acc, chunk) => acc + chunk.length, 0);
        const combinedArray = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of binaryChunks) {
            combinedArray.set(chunk, offset);
            offset += chunk.length;
        }

        // Create blob from the combined array
        const blob = new Blob([combinedArray], { type: fileData.type });
        const downloadUrl = URL.createObjectURL(blob);

        // Create and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = fileData.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Cleanup
        setTimeout(() => {
            URL.revokeObjectURL(downloadUrl);
        }, 1000);

        // Remove the file data from Firebase
        await remove(ref(database, `fileChunks/${user.uid}/${fileKey}`));
        await remove(fileRef);
        
        showToast('File downloaded successfully!', 'success');
        
    } catch (error) {
        console.error('Error downloading file:', error);
        showToast('Error downloading file: ' + error.message, 'error');
    } finally {
        progressElement.classList.add('hidden');
    }
}
        
        window.rejectFile = async function(fileKey) {
            const user = auth.currentUser;
            await remove(ref(database, `fileChunks/${user.uid}/${fileKey}`));
            await remove(ref(database, `files/${user.uid}/${fileKey}`));
        }

        function clearFileList() {
            document.getElementById('incomingFiles').innerHTML = '';
        }

        // Update the auth state change listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        const userRef = ref(database, `AirShare/${user.uid}/online`);
        set(userRef, true);
        
        window.addEventListener('beforeunload', () => {
            set(userRef, false);
        });

        switchToFileSharing(user);
    } else {
        // Ensure proper reset when user is signed out
        showSection('loginForm');
        clearFileList();
        // Hide the file sharing section
        document.getElementById('fileShareSection').classList.add('hidden');
    }
});
