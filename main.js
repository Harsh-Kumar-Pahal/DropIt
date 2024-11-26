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
        
                if (!receiverUid) {
                    alert('Receiver not found');
                    throw new Error('Receiver not found');
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
                    status: 'sending', // Indicates file is being sent
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
        
                // Update file status to ready-for-download after upload complete
                await update(fileRef, {
                    status: 'ready-for-download',
                    sendComplete: true
                });
        
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
        
        function getFileIcon(fileType) {
            // Map file types to appropriate icons or classes
            const iconMap = {
                'image/': `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>`,
                'video/': `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>`,
                'audio/': `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>`,
                'application/pdf': `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0013.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>`,
                'application/zip': `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>`,
                'text/': `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>`,
                'default': `<svg xmlns="http://www.w3.org/2000/svg" class="w-12 h-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>`
            };
        
            // Find the matching icon based on file type
            for (const [key, icon] of Object.entries(iconMap)) {
                if (fileType.includes(key)) {
                    return icon;
                }
            }
        
            // Return default icon if no match found
            return iconMap['default'];
        }
        
        function getUserIcon(email) {
            // Generate a deterministic color based on email
            const hashCode = (str) => {
                let hash = 0;
                for (let i = 0; i < str.length; i++) {
                    hash = ((hash << 5) - hash) + str.charCodeAt(i);
                    hash = hash & hash; // Convert to 32bit integer
                }
                return hash;
            };
        
            const colors = [
                'bg-blue-500', 'bg-green-500', 'bg-red-500', 
                'bg-purple-500', 'bg-indigo-500', 'bg-pink-500'
            ];
        
            const hash = Math.abs(hashCode(email));
            const colorIndex = hash % colors.length;
            const color = colors[colorIndex];
        
            // Extract first letter of email
            const initial = email[0].toUpperCase();
        
            return `
                <div class="w-12 h-12 rounded-full ${color} flex items-center justify-center text-white font-bold text-xl">
                    ${initial}
                </div>
            `;
        }
        
        function setupFileListeners(user) {
            const fileListContainer = document.getElementById('incomingFiles');
        
            onValue(ref(database, `files/${user.uid}`), async (snapshot) => {
                // Clear previous content
                fileListContainer.innerHTML = '';
        
                // Count files in different statuses
                const sendingFiles = [];
                const readyFiles = [];
        
                snapshot.forEach((childSnapshot) => {
                    const fileData = childSnapshot.val();
                    if (fileData.status === 'sending') {
                        sendingFiles.push(fileData);
                    }
                    if (fileData.status === 'ready-for-download') {
                        readyFiles.push(fileData);
                    }
                });
        
                // Display sending files count
                if (sendingFiles.length > 0) {
                    const sendingHeader = document.createElement('div');
                    sendingHeader.className = 'flex items-center space-x-2 mb-4 px-4 sm:px-0';
                    sendingHeader.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        <h3 class="text-lg sm:text-xl font-bold text-blue-700">
                            ${sendingFiles.length} File${sendingFiles.length > 1 ? 's' : ''} Incoming
                        </h3>
                    `;
                    fileListContainer.appendChild(sendingHeader);
                }
        
                // Display ready files count
                if (readyFiles.length > 0) {
                    const readyHeader = document.createElement('div');
                    readyHeader.className = 'flex items-center space-x-2 mb-4 px-4 sm:px-0';
                    readyHeader.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 class="text-lg sm:text-xl font-bold text-green-600">
                            ${readyFiles.length} File${readyFiles.length > 1 ? 's' : ''} Ready to Download
                        </h3>
                    `;
                    fileListContainer.appendChild(readyHeader);
                }
        
                // Process each file
                snapshot.forEach((childSnapshot) => {
                    const fileKey = childSnapshot.key;
                    const fileData = childSnapshot.val();
        
                    // Show file details for files ready for download
                    if (fileData.status === 'ready-for-download') {
                        const fileElement = document.createElement('div');
                        fileElement.className = 'bg-white shadow-md rounded-lg p-4 mb-4 flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4 mx-4 sm:mx-0';
                        fileElement.setAttribute('data-file-key', fileKey);
                        fileElement.innerHTML = `
                            <div class="flex-shrink-0 w-full sm:w-auto flex justify-center">
                                ${getFileIcon(fileData.type)}
                            </div>
                            <div class="flex-grow w-full text-center sm:text-left">
                                <div class="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                                    <div class="flex justify-center w-full sm:w-auto">
                                        ${getUserIcon(fileData.sender)}
                                    </div>
                                    <div class="text-center sm:text-left">
                                        <p class="font-semibold text-gray-800">${fileData.sender}</p>
                                        <p class="text-sm text-gray-500">Sent a file</p>
                                    </div>
                                </div>
                                <div class="mt-2">
                                    <p class="font-medium text-gray-700 break-words">${fileData.name}</p>
                                    <p class="text-sm text-gray-500">
                                        ${fileData.type} • ${(fileData.size / (1024 * 1024)).toFixed(2)} MB
                                    </p>
                                </div>
                            </div>
                            <div class="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 w-full sm:w-auto justify-center">
                                <button onclick="acceptFile('${fileKey}')" class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center justify-center space-x-2 transition duration-300 w-full sm:w-auto">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span class="hidden sm:inline">Accept</span>
                                </button>
                                <button onclick="rejectFile('${fileKey}')" class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md flex items-center justify-center space-x-2 transition duration-300 w-full sm:w-auto">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span class="hidden sm:inline">Reject</span>
                                </button>
                            </div>
                            <div id="progress-${fileKey}" class="hidden mt-2 w-full">
                                <div class="w-full bg-gray-200 rounded-full h-2.5">
                                    <div class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                                </div>
                                <p class="text-sm text-gray-600 mt-1">Downloading: 0%</p>
                            </div>
                        `;
                        fileListContainer.appendChild(fileElement);
                    }
                });
        
                // If no files are sending or ready, show a message
                if (fileListContainer.children.length === 0) {
                    const noFilesMessage = document.createElement('div');
                    noFilesMessage.className = 'text-center py-8 px-4';
                    noFilesMessage.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        <p class="text-gray-500 text-lg">No incoming files</p>
                    `;
                    fileListContainer.appendChild(noFilesMessage);
                }
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
        
            // Create progress element if it doesn't exist
            let progressElement = document.getElementById(`progress-${fileKey}`);
            if (!progressElement) {
                progressElement = document.createElement('div');
                progressElement.id = `progress-${fileKey}`;
                progressElement.className = 'mt-2';
                progressElement.innerHTML = `
                    <div class="w-full bg-gray-200 rounded-full h-2.5">
                        <div class="bg-blue-600 h-2.5 rounded-full" style="width: 0%"></div>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">Downloading: 0%</p>
                `;
                
                // Try to find the parent container to append the progress element
                const parentContainer = document.querySelector(`[data-file-key="${fileKey}"]`);
                if (parentContainer) {
                    parentContainer.appendChild(progressElement);
                } else {
                    console.warn(`Could not find parent container for file key: ${fileKey}`);
                    return;
                }
            }
        
            // Ensure progress element is visible
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
                        if (progressBar && progressText) {
                            progressBar.style.width = `${progress}%`;
                            progressText.textContent = `Downloading: ${progress.toFixed(1)}%`;
                        }
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
                // Only hide if the element exists
                if (progressElement) {
                    progressElement.classList.add('hidden');
                }
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
