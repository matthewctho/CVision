"use client";

import React, { useMemo, useState } from 'react';
import {
  ArrowDownUp, ArrowRight, CalendarDays, Car, Check, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, Clock3, Copy, GripVertical, Home, Info, Layers3,
  MapPin, Menu, Navigation, ParkingCircle, Route, Search, Settings2, Sparkles,
  Star, Timer, X, Zap
} from 'lucide-react';

const EVENTS = [
  { id: 1, title: 'Design sync at Figma', place: 'Figma HQ · 760 Market St', date: 'Today', time: '10:30 AM – 12:00 PM', color: 'purple', duration: '1 hr 30 min' },
  { id: 2, title: 'Lunch with Alex', place: 'The Progress · 1525 Fillmore St', date: 'Tomorrow', time: '12:30 PM – 2:00 PM', color: 'orange', duration: '1 hr 30 min' },
  { id: 3, title: 'Dentist appointment', place: 'Noe Valley Dental · 4015 24th St', date: 'Fri, Sep 19', time: '3:00 PM – 4:00 PM', color: 'blue', duration: '1 hr' },
];

const MOCK_SPOTS = [
  { id: 'a', name: 'Sutter Stockton Garage', distance: '0.2 mi', walk: '4 min walk', price: '$8/hr', total: '$16 estimated', free: false, score: 98, tone: 'purple' },
  { id: 'b', name: 'Union Square Parking', distance: '0.4 mi', walk: '7 min walk', price: 'Free', total: '2 hr limit', free: true, score: 94, tone: 'green' },
  { id: 'c', name: 'Fifth & Mission Garage', distance: '0.6 mi', walk: '11 min walk', price: '$5/hr', total: '$10 estimated', free: false, score: 86, tone: 'orange' },
  { id: 'd', name: 'Civic Center Lot', distance: '0.8 mi', walk: '15 min walk', price: '$3/hr', total: '$6 estimated', free: false, score: 78, tone: 'blue' },
];

const EVENT_PATHS = {
  1: MOCK_SPOTS,
  2: [
    { id: 'c', name: 'Fifth & Mission Garage', distance: '0.1 mi', walk: '3 min walk', price: '$5/hr', total: '$10 estimated', free: false, score: 96, tone: 'orange' },
    { id: 'b', name: 'Union Square Parking', distance: '0.5 mi', walk: '9 min walk', price: 'Free', total: '2 hr limit', free: true, score: 91, tone: 'green' },
    { id: 'a', name: 'Sutter Stockton Garage', distance: '0.7 mi', walk: '12 min walk', price: '$8/hr', total: '$16 estimated', free: false, score: 82, tone: 'purple' },
  ],
  3: [
    { id: 'd', name: 'Civic Center Lot', distance: '0.2 mi', walk: '4 min walk', price: '$3/hr', total: '$6 estimated', free: false, score: 97, tone: 'blue' },
    { id: 'b', name: 'Union Square Parking', distance: '0.8 mi', walk: '14 min walk', price: 'Free', total: '2 hr limit', free: true, score: 80, tone: 'green' },
    { id: 'c', name: 'Fifth & Mission Garage', distance: '1.0 mi', walk: '18 min walk', price: '$5/hr', total: '$10 estimated', free: false, score: 74, tone: 'orange' },
  ],
};

function Logo() {
  return <div className="brand"><span className="brand-mark"><ParkingCircle size={18} /></span><span>parkwise</span></div>;
}

function SignIn({ onSignIn }) {
  return (
    <main className="auth-shell">
      <div className="auth-orb orb-one" /><div className="auth-orb orb-two" />
      <header className="auth-nav"><Logo /></header>
      <section className="auth-content">
        <div className="auth-copy"><h1>Welcome to <em>Parkwise</em></h1></div>
        <div className="signin-card glass-card">
          <div className="signin-icon"><CalendarDays size={22} /></div>
          <h2>Welcome to Parkwise</h2>
          <p>Sign in with Google</p>
          <a className="google-button" href="/api/auth/google"><span className="google-g">G</span> Sign in with Google</a>
        </div>
      </section>
      <footer className="auth-footer"><span>© 2025 Parkwise</span></footer>
    </main>
  );
}

function EventCard({ event, selected, onClick }) {
  return <button className={`event-card ${selected ? 'selected' : ''}`} onClick={onClick}>
    <span className={`event-date ${event.color}`}><strong>{event.date === 'Today' ? '18' : event.id === 2 ? '19' : '20'}</strong><small>SEP</small></span>
    <span className="event-copy"><strong>{event.title}</strong><span>{event.place}</span><small>{event.time}</small></span>
    <ChevronRight size={18} className="event-arrow" />
  </button>;
}

function SortButton({ active, children, onClick, icon }) {
  return <button className={`sort-chip ${active ? 'active' : ''}`} onClick={onClick}>{icon}{children}</button>;
}

function RouteMap({ spots, selectedSpot, onSelect, destination, animationKey }) {
  const routePath = spots.length === 3
    ? 'M90 320 C 180 280, 155 200, 275 205 S 395 155, 485 75'
    : 'M90 320 C 180 280, 150 185, 260 210 S 380 170, 485 75';
  const pathId = `active-route-${animationKey}`;
  return <div className="map-card">
    <div className="map-toolbar"><div className="map-heading"><span className="map-heading-icon"><MapPin size={16} /></span><div><strong>Route preview</strong><span>{destination}</span></div></div><button className="map-tool"><Layers3 size={15} /> Layers</button></div>
    <div className="map-canvas">
      <div className="water water-one" /><div className="water water-two" />
      <div className="road road-one" /><div className="road road-two" /><div className="road road-three" /><div className="road road-four" />
      <div className="map-label label-market">MARKET ST</div><div className="map-label label-geary">GEARY ST</div><div className="map-label label-5th">5TH ST</div>
      <svg key={animationKey} className="route-line" viewBox="0 0 600 400" preserveAspectRatio="none"><path id={pathId} d={routePath} /><circle className="route-car" r="7"><animateMotion dur="2.8s" begin="0s" fill="freeze" repeatCount="1"><mpath href={`#${pathId}`} /></animateMotion></circle></svg>
      {spots.map((spot, index) => <button key={spot.id} className={`map-pin pin-${index + 1} ${selectedSpot === spot.id ? 'pin-selected' : ''}`} onClick={() => onSelect(spot.id)}><span>{index + 1}</span></button>)}
      <div className="destination-pin"><MapPin size={25} fill="currentColor" /><span>{destination.split(' · ')[0]}</span></div>
      <div className="map-zoom"><button><PlusIcon /></button><button><MinusIcon /></button></div>
      <div className="map-attribution">© Mapbox · Sample map</div>
    </div>
  </div>;
}

function PlusIcon() { return <span className="simple-icon">+</span>; }
function MinusIcon() { return <span className="simple-icon">−</span>; }

function SpotRow({ spot, index, selected, onSelect, onDragStart, onDragOver, onDrop, onDragEnd, dropTarget }) {
  return <div className={`spot-row ${selected ? 'selected' : ''} ${dropTarget ? 'drop-target' : ''}`} draggable
    onDragStart={event => onDragStart(event, index)}
    onDragOver={event => onDragOver(event, index)}
    onDrop={event => { event.preventDefault(); onDrop(event, index); }}
    onDragEnd={onDragEnd}
    onClick={() => onSelect(spot.id)}>
    <GripVertical size={16} className="drag-handle" /><span className={`spot-number ${spot.tone}`}>{index + 1}</span>
    <div className="spot-main"><div className="spot-title"><strong>{spot.name}</strong>{spot.free ? <span className="status free">FREE</span> : <span className="status paid">PAID</span>}</div><div className="spot-meta"><span><Navigation size={12} /> {spot.distance}</span><span><Clock3 size={12} /> {spot.walk}</span></div></div>
    <div className="spot-cost"><strong className={spot.free ? 'free-text' : ''}>{spot.price}</strong><span>{spot.total}</span></div><ChevronRight size={16} className="row-arrow" />
  </div>;
}

function Dashboard({ onSignOut }) {
  const [selectedEvent, setSelectedEvent] = useState(EVENTS[0]);
  const [filters, setFilters] = useState(['ai']);
  const [spots, setSpots] = useState(MOCK_SPOTS);
  const [dragSourceIndex, setDragSourceIndex] = useState(null);
  const [dragTargetIndex, setDragTargetIndex] = useState(null);
  const [selectedSpot, setSelectedSpot] = useState('a');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [animationKey, setAnimationKey] = useState(0);

  const selectEvent = event => {
    setSelectedEvent(event);
    setSpots(EVENT_PATHS[event.id].map(spot => ({ ...spot })));
    setSelectedSpot(EVENT_PATHS[event.id][0].id);
    setFilters(['ai']);
    setSaved(false);
    setAnimationKey(key => key + 1);
  };

  const sortedSpots = useMemo(() => {
    const copy = [...spots];
    if (!filters.length) return copy;
    return copy.sort((a, b) => {
      const rank = spot => filters.reduce((total, filter) => {
        if (filter === 'ai') return total + spot.score * 3;
        if (filter === 'free') return total + (spot.free ? 100 : 0);
        if (filter === 'nearest') return total + (1 - parseFloat(spot.distance)) * 100;
        return total + (20 - parseFloat(spot.price.replace('$', ''))) * 4;
      }, 0);
      return rank(b) - rank(a);
    });
  }, [spots, filters]);

  const routeMinutes = 8 + spots.reduce((total, spot) => total + parseInt(spot.walk, 10), 0);
  const arrivalMinutes = 30 - routeMinutes;
  const arrivalTime = `10:${String(Math.max(0, arrivalMinutes)).padStart(2, '0')} AM`;

  const toggleFilter = filter => {
    setFilters(current => current.includes(filter)
      ? current.filter(item => item !== filter)
      : [...current, filter]);
    setAnimationKey(key => key + 1);
  };

  const startDragging = (event, index) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(index));
    setDragSourceIndex(index);
  };
  const dragOver = (event, index) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragTargetIndex(index);
  };
  const reorder = (event, targetIndex) => {
    const parsedSource = event.dataTransfer.getData('text/plain');
    const sourceIndex = parsedSource === '' ? dragSourceIndex : Number(parsedSource);
    if (sourceIndex === null || sourceIndex === targetIndex || Number.isNaN(sourceIndex)) {
      setDragSourceIndex(null);
      setDragTargetIndex(null);
      return;
    }
    const next = [...sortedSpots];
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex >= next.length || targetIndex >= next.length) return;
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    setSpots(next);
    setFilters([]);
    setDragSourceIndex(null);
    setDragTargetIndex(null);
    setAnimationKey(key => key + 1);
  };
  const copyLink = () => { navigator.clipboard?.writeText('https://parkwise.app/path/figma-hq-demo'); setCopied(true); setTimeout(() => setCopied(false), 1800); };

  return <div className="dashboard-shell">
    <header className="topbar"><Logo /><nav><button className="nav-link active"><Home size={15} /> Overview</button><button className="nav-link"><CalendarDays size={15} /> Calendar</button><button className="nav-link"><Route size={15} /> Saved paths</button></nav><button className="location-button"><MapPin size={14} /> San Francisco <ChevronDown size={14} /></button><button className="profile-button"><span>JS</span><ChevronDown size={14} /></button><button className="mobile-menu"><Menu size={19} /></button></header>
    <main className="dashboard-content">
      <section className="dash-hero"><div><div className="eyebrow"><span className="live-dot" /> synced with Google Calendar</div><h1>Your day, <em>parked.</em></h1><p>Here’s your smartest route for today, Jamie.</p></div><div className="hero-actions"><button className="icon-button"><Settings2 size={17} /></button><button className="primary-button" onClick={() => setShowEvents(!showEvents)}><CalendarDays size={16} /> {showEvents ? 'Hide events' : 'View calendar'} <ChevronDown size={14} /></button></div></section>
      {showEvents && <div className="event-popover">{EVENTS.map(event => <button key={event.id} onClick={() => { selectEvent(event); setShowEvents(false); }}><span className={`mini-date ${event.color}`}>{event.date === 'Today' ? '18' : event.id === 2 ? '19' : '20'}</span><span><strong>{event.title}</strong><small>{event.time}</small></span><ChevronRight size={14} /></button>)}</div>}
      <section className="dashboard-grid">
        <div className="left-column"><div className="section-header"><div><span className="section-label">UP NEXT</span><h2>Calendar events</h2></div><button className="view-all">View all <ArrowRight size={14} /></button></div><div className="event-list">{EVENTS.map(event => <EventCard key={event.id} event={event} selected={selectedEvent.id === event.id} onClick={() => selectEvent(event)} />)}</div>
          <div className="section-header path-header"><div><span className="section-label">SMART ROUTE</span><h2>Parking stops</h2><p className="sub-copy">Drag to reorder your route</p></div><button className="ai-badge"><Sparkles size={14} /> AI optimized</button></div>
          <div className="sort-bar"><span>Rank by</span><SortButton active={filters.includes('ai')} onClick={() => toggleFilter('ai')} icon={<Sparkles size={13} />}>AI suggested</SortButton><SortButton active={filters.includes('free')} onClick={() => toggleFilter('free')} icon={<Check size={13} />}>Free first</SortButton><SortButton active={filters.includes('nearest')} onClick={() => toggleFilter('nearest')} icon={<Navigation size={13} />}>Nearest</SortButton><SortButton active={filters.includes('cheapest')} onClick={() => toggleFilter('cheapest')} icon={<Star size={13} />}>Cheapest</SortButton></div>
          <div className="route-summary"><span className="summary-icon"><Timer size={17} /></span><div><span>Total route time</span><strong>{routeMinutes} min</strong></div><i /><div><span>Arrival by</span><strong>{arrivalTime}</strong></div><Info size={14} className="summary-info" /></div>
          <div className="spots-list">{sortedSpots.map((spot, index) => <SpotRow key={spot.id} spot={spot} index={index} selected={selectedSpot === spot.id} dropTarget={dragTargetIndex === index} onSelect={setSelectedSpot} onDragStart={startDragging} onDragOver={dragOver} onDrop={reorder} onDragEnd={() => { setDragSourceIndex(null); setDragTargetIndex(null); }} />)}</div>
          <button className={`save-button ${saved ? 'saved' : ''}`} onClick={() => setSaved(true)}>{saved ? <><Check size={17} /> Path saved to calendar</> : <><Star size={17} /> Save this path</>}</button>
          {saved && <div className="share-row"><span><Check size={14} /> Added to “{selectedEvent.title}”</span><button onClick={copyLink}>{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy link'}</button></div>}</div>
        <div className="right-column"><RouteMap spots={sortedSpots} selectedSpot={selectedSpot} onSelect={setSelectedSpot} destination={selectedEvent.place} animationKey={animationKey} /><div className="arrival-card"><div className="arrival-title"><span className="destination-icon"><MapPin size={16} /></span><div><span>YOUR DESTINATION</span><strong>{selectedEvent.place}</strong></div><button><MoreIcon /></button></div><div className="arrival-stats"><div><span>Drive to first stop</span><strong>12 min</strong></div><div><span>Walk to destination</span><strong>{spots[spots.length - 1]?.walk.split(' ')[0]} min</strong></div><div><span>Arrive by</span><strong>{arrivalTime}</strong></div></div><div className="arrival-note"><Sparkles size={14} /><span>Leave by <strong>9:46 AM</strong> for a relaxed arrival</span></div></div></div>
      </section>
    </main><footer className="dash-footer"><span><ParkingCircle size={14} /> Parkwise <small>· Frontend prototype</small></span><button onClick={onSignOut}>Sign out</button><span>Need help? <CircleHelp size={13} /> Help center</span></footer>
  </div>;
}
function MoreIcon() { return <span className="more-icon">•••</span>; }


export default function App({ initialSignedIn = false }) {
  const [signedIn, setSignedIn] = useState(initialSignedIn);
  return signedIn
    ? <Dashboard onSignOut={() => { window.location.href = '/api/auth/logout'; }} />
    : <SignIn />;
}
