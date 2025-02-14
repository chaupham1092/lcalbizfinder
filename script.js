// Initialize the map
const map = L.map('map').setView([37.7749, -122.4194], 13); // Default to San Francisco
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors'
}).addTo(map);

let markers = []; // Store all markers and circles
let apiKey = null; // Store API key once fetched

// Initialize Firebase
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const stripe = Stripe(process.env.STRIPE_PUBLISHABLE_KEY);

// Fetch API key using the same method as 1st code
fetch("/.netlify/functions/get-api-key")
  .then(response => response.json())
  .then(config => {
    apiKey = config.API_KEY;
  })
  .catch(error => {
    console.error("Error fetching API key:", error);
    alert("Failed to retrieve API key. Please try again later.");
  });

// Change cursor to crosshair
map.getContainer().style.cursor = 'crosshair';

// Update radius value display
const radiusInput = document.getElementById('radius');
const radiusValue = document.getElementById('radiusValue');
radiusInput.addEventListener('input', () => {
  radiusValue.textContent = radiusInput.value;
});

// Add a pin to the map
map.on('click', (e) => {
  const { lat, lng } = e.latlng;
  const radius = radiusInput.value;

  const marker = L.marker([lat, lng]).addTo(map);
  const circle = L.circle([lat, lng], { radius }).addTo(map);

  markers.push({ marker, circle, radius });

  marker.on('click', () => {
    map.removeLayer(marker);
    map.removeLayer(circle);
    markers = markers.filter(m => m.marker !== marker);
  });
});

// Go to Location Feature
document.getElementById('goToButton').addEventListener('click', () => {
  const location = document.getElementById('goToLocation').value;
  if (!location) {
    alert('Please enter a location.');
    return;
  }

  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`)
    .then(response => response.json())
    .then(data => {
      if (data.length > 0) {
        const { lat, lon } = data[0];
        map.setView([lat, lon], 13);
      } else {
        alert('Location not found.');
      }
    })
    .catch(error => {
      console.error('Error fetching location:', error);
      alert('Failed to fetch location. Please try again.');
    });
});

// Autocomplete Feature
const queryInput = document.getElementById('query');
const autocompleteResults = document.getElementById('autocompleteResults');

queryInput.addEventListener('input', async () => {
  const query = queryInput.value;
  if (query.length < 3 || !apiKey) {
    autocompleteResults.style.display = 'none';
    return;
  }

  const url = `https://api.magicapi.dev/api/v1/openwebninja/local-business-data/autocomplete?input=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'accept': 'application/json',
        'x-magicapi-key': apiKey
      }
    });
    const data = await response.json();

    if (data.data && data.data.length > 0) {
      autocompleteResults.innerHTML = data.data.map(item => `
        <div class="autocomplete-item" data-query="${item}">${item}</div>
      `).join('');
      autocompleteResults.style.display = 'block';
    } else {
      autocompleteResults.style.display = 'none';
    }
  } catch (error) {
    console.error('Error fetching autocomplete results:', error);
  }
});

// Handle autocomplete item selection
autocompleteResults.addEventListener('click', (e) => {
  if (e.target.classList.contains('autocomplete-item')) {
    queryInput.value = e.target.getAttribute('data-query');
    autocompleteResults.style.display = 'none';
  }
});

// Fetch businesses on button click
document.getElementById('fetchBusinesses').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) {
    alert('Please sign in to perform searches.');
    return;
  }

  const userRef = db.collection('users').doc(user.uid);
  const doc = await userRef.get();
  if (!doc.exists || doc.data().searchesRemaining <= 0) {
    alert('No searches remaining. Please purchase more searches.');
    return;
  }

  if (!apiKey) {
    alert('API key not loaded. Please refresh the page and try again.');
    return;
  }

  if (markers.length === 0) {
    alert('Please drop at least one pin on the map first.');
    return;
  }

  const query = queryInput.value;
  if (!query) {
    alert('Please enter a search term (e.g., restaurants, plumbers).');
    return;
  }

  const loading = document.getElementById('loading');
  const businessList = document.getElementById('businessList');
  loading.style.display = 'block';
  businessList.innerHTML = '';

  const allBusinesses = [];

  try {
    for (const { marker, radius } of markers) {
      const lat = marker.getLatLng().lat;
      const lng = marker.getLatLng().lng;

      const url = `https://api.magicapi.dev/api/v1/openwebninja/local-business-data/search-nearby?query=${encodeURIComponent(query)}&lat=${lat}&lng=${lng}&radius=${radius}&extract_emails_and_contacts=true&limit=20`;

      const response = await fetch(url, {
        headers: {
          'accept': 'application/json',
          'x-magicapi-key': apiKey
        }
      });
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        allBusinesses.push(...data.data);
      }
    }

    loading.style.display = 'none';

    if (allBusinesses.length > 0) {
      businessList.innerHTML = allBusinesses.map(business => `
        <div class="business-item">
          <h3>${business.name}</h3>
          <p>Phone: ${business.phone_number || 'N/A'}</p>
          <p>Email: ${business.emails_and_contacts?.emails?.[0] || 'N/A'}</p>
          <p>Website: ${business.website || 'N/A'}</p>
        </div>
      `).join('');
    } else {
      businessList.innerHTML = '<p>No businesses found in the selected areas.</p>';
    }

    // Decrement the search quota
    await userRef.update({ searchesRemaining: doc.data().searchesRemaining - 1 });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    loading.style.display = 'none';
    alert('Failed to fetch businesses. Please try again.');
  }
});

// Handle payment button click
document.getElementById('paymentButton').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) {
    alert('Please sign in to make a payment.');
    return;
  }

  const response = await fetch('/.netlify/functions/create-checkout-session', {
    method: 'POST',
  });
  const session = await response.json();
  const result = await stripe.redirectToCheckout({ sessionId: session.id });
  if (result.error) {
    alert(result.error.message);
  }
});

// Track user authentication state
auth.onAuthStateChanged(async (user) => {
  if (user) {
    const userRef = db.collection('users').doc(user.uid);
    const doc = await userRef.get();
    if (!doc.exists) {
      await userRef.set({ searchesRemaining: 100 });
    }
  }
});
