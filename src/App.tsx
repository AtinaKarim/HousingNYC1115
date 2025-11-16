import React, { useState, useEffect, useRef } from 'react';
import { Home, Search, Database, AlertTriangle, ExternalLink, Loader, Key, Info, MapPin } from 'lucide-react';

const App = () => {
  // Load Inter font programmatically
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    
    // Apply font to body
    document.body.style.fontFamily = "'Inter', sans-serif";
    
    return () => {
      document.body.style.fontFamily = '';
    };
  }, []);

  const [activeTab, setActiveTab] = useState('overview');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [buildingData, setBuildingData] = useState(null);
  const [error, setError] = useState(null);
  const [apiToken, setApiToken] = useState('');
  const [showApiSetup, setShowApiSetup] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [rentStabRegistry, setRentStabRegistry] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingRegistry, setLoadingRegistry] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [showGoogleMapsSetup, setShowGoogleMapsSetup] = useState(false);
  const [mapCoordinates, setMapCoordinates] = useState(null);
  const mapRef = useRef(null);
  const googleMapInstance = useRef(null);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Home },
    { id: 'data', label: 'Data Sources', icon: Database },
    { id: 'demo', label: 'Search Buildings', icon: Search }
  ];

  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Load Google Maps API
  useEffect(() => {
    if (googleMapsApiKey && !window.google) {
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setMapsLoaded(true);
        console.log('Google Maps loaded successfully');
      };
      script.onerror = () => {
        console.error('Failed to load Google Maps');
        alert('Failed to load Google Maps. Please check your API key.');
      };
      document.head.appendChild(script);
    } else if (window.google) {
      setMapsLoaded(true);
    }
  }, [googleMapsApiKey]);

  // Initialize map when coordinates are available
  useEffect(() => {
    if (mapCoordinates && mapRef.current && mapsLoaded && googleMapsApiKey) {
      console.log('Initializing map with coordinates:', mapCoordinates);
      
      try {
        if (!googleMapInstance.current) {
          googleMapInstance.current = new window.google.maps.Map(mapRef.current, {
            center: { lat: mapCoordinates.lat, lng: mapCoordinates.lng },
            zoom: 18,
            mapTypeId: 'satellite',
            tilt: 45
          });
          console.log('Map created');
        } else {
          googleMapInstance.current.setCenter({ lat: mapCoordinates.lat, lng: mapCoordinates.lng });
          console.log('Map center updated');
        }

        new window.google.maps.Marker({
          position: { lat: mapCoordinates.lat, lng: mapCoordinates.lng },
          map: googleMapInstance.current,
          title: buildingData?.address || 'Building Location'
        });
        console.log('Marker added');
      } catch (error) {
        console.error('Error initializing map:', error);
      }
    }
  }, [mapCoordinates, mapsLoaded, googleMapsApiKey, buildingData]);

  const dataSources = [
    {
      name: 'NYC Open Data Portal',
      url: 'https://opendata.cityofnewyork.us/',
      datasets: ['HPD Violations (600K+ records)', 'DOB Violations', 'PLUTO Tax Lot Data']
    },
    {
      name: 'Rent Stabilization Registry',
      url: 'https://docs.google.com/spreadsheets/d/1_yUjWl9Z1z6T_8oRqXscOU6KFV25ECYgVO69lORFyxI',
      datasets: ['Verified rent-stabilized buildings with autocomplete']
    }
  ];

  useEffect(() => {
    const loadRegistry = async () => {
      setLoadingRegistry(true);
      try {
        const sheetId = '1_yUjWl9Z1z6T_8oRqXscOU6KFV25ECYgVO69lORFyxI';
        const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
        const response = await fetch(csvUrl);
        const text = await response.text();
        const lines = text.split('\n').slice(1);
        const buildings = lines.map(line => {
          const cols = line.split(',');
          if (cols.length < 3) return null;
          return {
            number: cols[0]?.trim(),
            street: cols[1]?.trim(),
            borough: cols[2]?.trim(),
            zip: cols[3]?.trim(),
            fullAddress: `${cols[0]?.trim()} ${cols[1]?.trim()}, ${cols[2]?.trim()}`
          };
        }).filter(b => b && b.number && b.street);
        setRentStabRegistry(buildings);
      } catch (err) {
        console.warn('Could not load registry:', err);
      } finally {
        setLoadingRegistry(false);
      }
    };
    loadRegistry();
  }, []);

  const handleAddressChange = (value) => {
    setAddress(value);
    if (buildingData) {
      setBuildingData(null);
      setError(null);
      setDebugInfo(null);
    }
    if (value.length >= 3 && rentStabRegistry.length > 0) {
      const filtered = rentStabRegistry
        .filter(b => b.fullAddress.toLowerCase().includes(value.toLowerCase()))
        .slice(0, 10);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (suggestion) => {
    setAddress(suggestion.fullAddress);
    setShowSuggestions(false);
    setTimeout(() => searchBuilding(suggestion.fullAddress), 100);
  };

  const normalizeAddress = (input) => {
    let normalized = input.trim();
    const spellingCorrections = {
      'manhatten': 'Manhattan', 'manhatan': 'Manhattan',
      'brookln': 'Brooklyn', 'quens': 'Queens'
    };
    Object.entries(spellingCorrections).forEach(([wrong, correct]) => {
      normalized = normalized.replace(new RegExp(`\\b${wrong}\\b`, 'gi'), correct);
    });
    const replacements = {
      '\\bSt\\.?(?!\\w)': 'Street', '\\bAve?\\.?(?!\\w)': 'Avenue'
    };
    Object.entries(replacements).forEach(([pattern, replacement]) => {
      normalized = normalized.replace(new RegExp(pattern, 'gi'), replacement);
    });
    if (!/\bNY\b/i.test(normalized)) normalized += ', NY';
    return normalized;
  };

  const parseAddress = (addressStr) => {
    const match = addressStr.match(/^(\d+(?:-\d+)?)\s+(.+?)(?:,|$)/);
    if (match) {
      return { housenumber: match[1], street: match[2].trim().toUpperCase() };
    }
    return null;
  };

  const checkRentStabRegistry = (housenumber, street) => {
    return rentStabRegistry.some(b => 
      b.number === housenumber && b.street.toUpperCase() === street
    );
  };

  const calculateHealthScore = (allData) => {
    if (!allData || allData.length === 0) return 'A';
    let totalScore = 0;
    allData.forEach(item => {
      if (item.source === 'HPD') {
        if (item.severity === 'A') totalScore += 10;
        else if (item.severity === 'B') totalScore += 3;
        else if (item.severity === 'C') totalScore += 1;
      }
    });
    if (totalScore === 0) return 'A';
    if (totalScore <= 8) return 'B';
    if (totalScore <= 20) return 'C';
    if (totalScore <= 40) return 'D';
    return 'F';
  };

  const extractIssues = (allData) => {
    const issueKeywords = {
      'Heat/Hot Water': ['heat', 'hot water', 'boiler'],
      'Pest Infestation': ['roach', 'rat', 'mice', 'pest'],
      'Mold': ['mold', 'mildew'],
      'Plumbing': ['plumbing', 'leak', 'pipe']
    };
    const foundIssues = new Set();
    allData.forEach(item => {
      const desc = item.description.toLowerCase();
      Object.entries(issueKeywords).forEach(([issue, keywords]) => {
        if (keywords.some(keyword => desc.includes(keyword))) {
          foundIssues.add(issue);
        }
      });
    });
    return Array.from(foundIssues);
  };

  const normalizeData = (rawData, source) => {
    return rawData.map(item => {
      let normalized = { source, description: '', severity: '', date: '', status: '', type: '' };
      if (source === 'HPD') {
        normalized.description = item.novdescription || item.violationstatus || 'HPD Violation';
        normalized.severity = item.class || item.violationclass || 'C';
        normalized.type = 'Housing Violation';
      }
      return normalized;
    });
  };

  const searchBuilding = async (overrideAddress) => {
    const searchAddress = overrideAddress || address;
    if (!searchAddress.trim()) {
      setError('Please enter an address');
      return;
    }
  
    setLoading(true);
    setError(null);
    setBuildingData(null);
  
    try {
      const normalizedAddress = normalizeAddress(searchAddress);
      let housenumber, street, borough, formattedAddress;
      
      try {
        const geocodeUrl = `https://geosearch.planninglabs.nyc/v2/search?text=${encodeURIComponent(normalizedAddress)}`;
        const geocodeResponse = await fetch(geocodeUrl);
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.features && geocodeData.features.length > 0) {
            const location = geocodeData.features[0];
            housenumber = location.properties.housenumber;
            street = location.properties.street;
            borough = location.properties.borough;
            formattedAddress = `${housenumber} ${street}, ${borough}, NY`;
            
            // Extract coordinates for Google Maps
            if (location.geometry && location.geometry.coordinates) {
              setMapCoordinates({
                lng: location.geometry.coordinates[0],
                lat: location.geometry.coordinates[1]
              });
            }
            
            console.log('Geocoded:', { housenumber, street, borough });
          }
        }
      } catch (err) {
        console.warn('Geocoding failed:', err);
      }
      
      if (!housenumber || !street) {
        const parsed = parseAddress(normalizedAddress);
        if (!parsed) throw new Error('Could not parse address');
        housenumber = parsed.housenumber;
        street = parsed.street;
        const boroughMatch = normalizedAddress.match(/\b(Manhattan|Brooklyn|Queens|Bronx|Staten Island)\b/i);
        borough = boroughMatch ? boroughMatch[1] : 'NYC';
        formattedAddress = `${housenumber} ${street}, ${borough}, NY`;
        console.log('Manual parsed:', { housenumber, street, borough });
      }
  
      const boroMap = {
        'Manhattan': 'MANHATTAN',
        'Brooklyn': 'BROOKLYN',
        'Queens': 'QUEENS',
        'Bronx': 'BRONX',
        'Staten Island': 'STATEN ISLAND'
      };
      const boroName = boroMap[borough] || borough.toUpperCase();
  
      const headers = apiToken ? { 'X-App-Token': apiToken } : {};
      
      let hpdData = [];
      
      const strategy1Url = `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?housenumber=${encodeURIComponent(housenumber)}&streetname=${encodeURIComponent(street.toUpperCase())}&$limit=1000`;
      console.log('Strategy 1 URL:', strategy1Url);
      
      try {
        const response = await fetch(strategy1Url, { headers });
        if (response.ok) {
          hpdData = await response.json();
          console.log(`Strategy 1: Found ${hpdData.length} violations`);
        }
      } catch (err) {
        console.warn('Strategy 1 error:', err);
      }
      
      if (hpdData.length === 0) {
        const strategy2Url = `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?$where=housenumber='${housenumber}' AND streetname LIKE '${street.toUpperCase()}%'&$limit=1000`;
        console.log('Strategy 2 URL:', strategy2Url);
        
        try {
          const response = await fetch(strategy2Url, { headers });
          if (response.ok) {
            hpdData = await response.json();
            console.log(`Strategy 2: Found ${hpdData.length} violations`);
          }
        } catch (err) {
          console.warn('Strategy 2 error:', err);
        }
      }
      
      if (hpdData.length === 0) {
        const strategy3Url = `https://data.cityofnewyork.us/resource/wvxf-dwi5.json?housenumber=${encodeURIComponent(housenumber)}&boro=${encodeURIComponent(boroName)}&$limit=1000`;
        console.log('Strategy 3 URL:', strategy3Url);
        
        try {
          const response = await fetch(strategy3Url, { headers });
          if (response.ok) {
            const allResults = await response.json();
            console.log(`Strategy 3: Got ${allResults.length} total results for house number in borough`);
            
            hpdData = allResults.filter(item => {
              const itemStreet = (item.streetname || '').toUpperCase();
              const searchStreet = street.toUpperCase();
              return itemStreet.includes(searchStreet) || searchStreet.includes(itemStreet);
            });
            console.log(`Strategy 3: Filtered to ${hpdData.length} violations matching street`);
          }
        } catch (err) {
          console.warn('Strategy 3 error:', err);
        }
      }
  
      console.log(`FINAL HPD DATA: ${hpdData.length} violations found`);
  
      let plutoData = [];
      let buildingYear = null;
      let totalUnits = null;
      let rentStabilizedUnits = 0;
      try {
        const url = `https://data.cityofnewyork.us/resource/64uk-42ks.json?address=${encodeURIComponent(housenumber + ' ' + street)}&$limit=50`;
        const response = await fetch(url, { headers });
        if (response.ok) {
          plutoData = await response.json();
          if (plutoData.length > 0) {
            buildingYear = plutoData[0].yearbuilt;
            totalUnits = parseInt(plutoData[0].unitsres || 0);
            rentStabilizedUnits = parseInt(plutoData[0].unitsstab2007 || plutoData[0].unitsstab || 0);
          }
        }
      } catch (err) {
        console.warn('PLUTO fetch error:', err);
      }
  
      const inRegistry = checkRentStabRegistry(housenumber, street);
      let isRentStabilized = inRegistry || rentStabilizedUnits > 0;
      let rentStabSource = '';
      
      if (inRegistry) rentStabSource = 'Community Registry';
      if (rentStabilizedUnits > 0) {
        rentStabSource = rentStabSource ? rentStabSource + ' + Tax Bills' : 'Tax Bills';
      }
      if (!isRentStabilized && buildingYear && parseInt(buildingYear) < 1974 && totalUnits >= 6) {
        rentStabSource = 'Potentially Rent Stabilized (pre-1974, 6+ units)';
      }
  
      const normalizedHPD = normalizeData(hpdData, 'HPD');
      const allData = [...normalizedHPD];
  
      const counts = {
        hpd: { total: normalizedHPD.length, classA: 0, classB: 0, classC: 0 },
        dobViolations: { total: 0 },
        rodent: { total: 0, failed: 0 }
      };
      
      normalizedHPD.forEach(v => {
        if (v.severity === 'A') counts.hpd.classA++;
        else if (v.severity === 'B') counts.hpd.classB++;
        else if (v.severity === 'C') counts.hpd.classC++;
      });
  
      const healthScore = calculateHealthScore(allData);
      const issues = extractIssues(allData);
  
      const medianRents = {
        'Manhattan': 4200, 'Brooklyn': 3400, 'Queens': 2600,
        'Bronx': 2100, 'Staten Island': 2300, 'NYC': 3500
      };
      
      const baseRent = medianRents[borough] || 3000;
      let sizeMultiplier = 1.0;
      if (totalUnits > 100) sizeMultiplier = 1.15;
      else if (totalUnits > 50) sizeMultiplier = 1.08;
      
      let ageMultiplier = 1.0;
      const year = parseInt(buildingYear) || 0;
      if (year >= 2015) ageMultiplier = 1.25;
      else if (year >= 2000) ageMultiplier = 1.12;
      else if (year > 0 && year < 1950) ageMultiplier = 0.90;
      
      const estimatedRent = Math.round(baseRent * sizeMultiplier * ageMultiplier);
  
      setBuildingData({
        address: formattedAddress,
        healthScore,
        counts,
        totalRecords: allData.length,
        issues: issues.length > 0 ? issues : ['No major issues found'],
        rentComparison: {
          asking: estimatedRent,
          median: baseRent,
          borough: borough || 'NYC',
          isRentStabilized,
          stabilizedUnits: rentStabilizedUnits,
          totalUnits,
          buildingYear,
          source: rentStabSource
        },
        lastUpdated: new Date().toLocaleDateString()
      });
  
      setDebugInfo({ 
        sources: `HPD: ${normalizedHPD.length}`, 
        total: allData.length,
        searchedFor: `${housenumber} ${street}, ${borough}`
      });
  
    } catch (err) {
      setError(err.message || 'An error occurred');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white p-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="max-w-6xl mx-auto">
        {/* Google Maps API Setup Banner */}
        {!googleMapsApiKey && (
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4 mb-6 flex items-start gap-3">
            <MapPin className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-blue-900 mb-2">Add Google Maps API Key to View Building Locations</p>
              <p className="text-sm text-blue-800 mb-3">
                Get a free API key at{' '}
                <a href="https://developers.google.com/maps/documentation/javascript/get-api-key" target="_blank" rel="noopener noreferrer" className="underline">
                  Google Cloud Console
                </a>
              </p>
              <button
                onClick={() => setShowGoogleMapsSetup(!showGoogleMapsSetup)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                {showGoogleMapsSetup ? 'Hide Setup' : 'Add Google Maps API Key'}
              </button>
              
              {showGoogleMapsSetup && (
                <div className="mt-4 bg-white rounded-lg p-4 border border-blue-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Paste Your Google Maps API Key
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={googleMapsApiKey}
                      onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                      placeholder="Enter your Google Maps API key here"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        if (googleMapsApiKey.trim()) {
                          setShowGoogleMapsSetup(false);
                          alert('Google Maps API key saved! Maps will now appear with search results.');
                        }
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Your API key is stored in browser memory only and never sent anywhere except Google Maps.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {googleMapsApiKey && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-green-600" />
              <span className="text-green-900 font-semibold">Google Maps Active</span>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Remove Google Maps API key?')) {
                  setGoogleMapsApiKey('');
                  setMapCoordinates(null);
                  googleMapInstance.current = null;
                }
              }}
              className="text-sm text-green-700 underline hover:text-green-900"
            >
              Remove
            </button>
          </div>
        )}

        {/* API Setup Banner */}
        {!apiToken && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-4 mb-6 flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-yellow-900 mb-2">Optional: Add NYC Open Data API Token for Better Performance</p>
              <p className="text-sm text-yellow-800 mb-3">
                Without a token, you're limited to 1,000 requests/day. Get a free token at{' '}
                <a href="https://data.cityofnewyork.us/signup" target="_blank" rel="noopener noreferrer" className="underline">
                  NYC Open Data
                </a>
              </p>
              <button
                onClick={() => setShowApiSetup(!showApiSetup)}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-700 flex items-center gap-2"
              >
                <Key className="w-4 h-4" />
                {showApiSetup ? 'Hide Setup' : 'Add API Token'}
              </button>
              
              {showApiSetup && (
                <div className="mt-4 bg-white rounded-lg p-4 border border-yellow-200">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Paste Your API Token (X-App-Token)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={apiToken}
                      onChange={(e) => setApiToken(e.target.value)}
                      placeholder="Enter your API token here"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <button
                      onClick={() => {
                        if (apiToken.trim()) {
                          setShowApiSetup(false);
                          alert('API token saved! You can now make more requests.');
                        }
                      }}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-700"
                    >
                      Save
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    Your token is stored in browser memory only and never sent anywhere except NYC Open Data.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {apiToken && (
          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-green-600" />
              <span className="text-green-900 font-semibold">API Token Active</span>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Remove API token?')) {
                  setApiToken('');
                }
              }}
              className="text-sm text-green-700 underline hover:text-green-900"
            >
              Remove
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Home className="w-10 h-10 text-blue-700" />
            <div>
              <h1 className="text-3xl font-bold text-blue-900">NYC Housing Justice Platform</h1>
              <p className="text-blue-700">Real-time data for NYC renters</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg mb-6 overflow-hidden">
          <div className="flex flex-wrap border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-blue-600 text-white border-b-4 border-blue-800' 
                      : 'text-blue-700 hover:bg-blue-50 hover:text-blue-900'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-8">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-blue-900">About This Platform</h2>
                <p className="text-blue-700 text-lg">
                  This platform helps NYC renters research apartments before signing leases using open government data.
                </p>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-blue-900">Open Data Sources</h2>
                {dataSources.map((source, idx) => (
                  <div key={idx} className="border border-blue-200 rounded-lg p-6 bg-white">
                    <h3 className="text-xl font-bold text-blue-900 mb-2">{source.name}</h3>
                    <ul className="list-disc list-inside text-blue-700">
                      {source.datasets.map((d, i) => (<li key={i}>{d}</li>))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'demo' && (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-blue-900 mb-4">Search NYC Buildings</h2>
                
                <div className="bg-white border-2 border-blue-300 rounded-lg p-6">
                  <label className="block text-sm font-semibold text-blue-700 mb-2">Enter NYC Address</label>
                  {!loadingRegistry && rentStabRegistry.length > 0 && (
                    <p className="text-xs text-blue-600 mb-2">✓ Loaded {rentStabRegistry.length.toLocaleString()} rent-stabilized addresses</p>
                  )}
                  <div className="relative">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => handleAddressChange(e.target.value)}
                        placeholder="e.g., 350 5th Avenue, Manhattan"
                        className="flex-1 px-4 py-3 border border-blue-300 rounded-lg text-blue-800"
                        onKeyPress={(e) => e.key === 'Enter' && searchBuilding()}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        disabled={loading}
                      />
                      <button
                        onClick={() => searchBuilding()}
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                      >
                        {loading ? <Loader className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                        {loading ? 'Searching...' : 'Search'}
                      </button>
                    </div>
                    
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                        {suggestions.map((suggestion, idx) => (
                          <div
                            key={idx}
                            onClick={() => selectSuggestion(suggestion)}
                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                          >
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-semibold">RENT STABILIZED</span>
                            <div className="text-sm font-medium text-blue-900 mt-1">{suggestion.fullAddress}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-800">{error}</p>
                  </div>
                )}

                {buildingData && (
                  <div className="space-y-4">
                    {/* Google Map Display */}
                    {googleMapsApiKey && mapCoordinates && (
                      <div className="bg-white rounded-lg shadow-lg overflow-hidden border-2 border-blue-300">
                        <div className="bg-blue-600 px-4 py-2 flex items-center gap-2">
                          <MapPin className="w-5 h-5 text-white" />
                          <span className="text-white font-semibold">Building Location</span>
                          {!mapsLoaded && (
                            <span className="text-xs text-blue-100 ml-2">(Loading map...)</span>
                          )}
                        </div>
                        <div 
                          ref={mapRef} 
                          style={{ width: '100%', height: '400px', backgroundColor: '#e5e7eb' }}
                          className="flex items-center justify-center"
                        >
                          {!mapsLoaded && (
                            <div className="text-gray-500 flex items-center gap-2">
                              <Loader className="w-5 h-5 animate-spin" />
                              <span>Loading Google Maps...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {googleMapsApiKey && !mapCoordinates && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-yellow-800 text-sm">
                          📍 Unable to find coordinates for this address. Map cannot be displayed.
                        </p>
                      </div>
                    )}

                    <div className="bg-white rounded-lg shadow-lg p-6 border-l-4 border-blue-500">
                      <h3 className="text-xl font-bold mb-2 text-blue-900">{buildingData.address}</h3>
                      <div className="text-6xl font-bold text-blue-600 mb-4">{buildingData.healthScore}</div>
                      <p className="text-sm text-blue-700">Based on {buildingData.totalRecords} records</p>
                      <div className="mt-4">
                        <p className="text-blue-700">HPD Violations: {buildingData.counts.hpd.total}</p>
                        {buildingData.rentComparison.isRentStabilized && (
                          <div className="bg-blue-50 p-4 rounded mt-4">
                            <p className="font-bold text-blue-900">✅ Rent Stabilized Building</p>
                            <p className="text-sm text-blue-800">{buildingData.rentComparison.source}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;