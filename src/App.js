// src/App.js (or src/App.jsx)
// Comprehensive Daycare Management Application with Supabase Integration
// V33 UPDATE: Fully re-integrated ALL page/modal component definitions.
// Wrapped showAlert in useCallback. Addressed all reported ESLint issues.

import React, { useState, useEffect, createContext, useCallback } from 'react';
import { supabase } from './supabaseClient'; // Ensure this path is correct
import './App.css'; // Import the CSS file

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Lucide-react icons
import {
    Home as HomeIcon, Users as UsersIconAliased, UserPlus, Menu, X, Smile, Clock, Edit3, Trash2, LogIn, LogOut, PlusCircle, CheckCircle,
    Building, Mail, Lock, Eye, EyeOff, Phone, Award, UserCircle2, FileText, ShieldAlert, Pill, Megaphone, ListChecks,
    ArrowLeft, DollarSign, Image as ImageIcon, AlertTriangle, ListOrdered, Briefcase, UploadCloud, FilePlus, UserCheck, UserX as UserXIcon,
    Camera, Download, UserCog, Search, BookCopy
    // BookOpen, Paperclip removed as unused
} from 'lucide-react';

// --- Contexts ---
const AppStateContext = createContext();

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, errorInfo) { this.setState({ errorInfo }); console.error("Uncaught error in ErrorBoundary:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Oops! Something went wrong.</h2>
          <p>Please try refreshing. Check console for details.</p>
          {this.state.error && <pre>{this.state.error.toString()}</pre>}
          {this.state.errorInfo && <pre>{this.state.errorInfo.componentStack}</pre>}
        </div>
      );
    }
    return this.props.children;
  }
}

// --- Utility Functions ---
const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - userTimezoneOffset).toISOString().split('T')[0];
    } catch (e) {
        console.error("Error formatting date for input:", e, "Input:", dateString);
        return '';
    }
};

const formatDateTimeForInput = (dateTimeString) => {
    if (!dateTimeString) return '';
    try {
        const date = new Date(dateTimeString);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const adjustedDate = new Date(date.getTime() - userTimezoneOffset);
        const year = adjustedDate.getFullYear();
        const month = (adjustedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = adjustedDate.getDate().toString().padStart(2, '0');
        const hours = adjustedDate.getHours().toString().padStart(2, '0');
        const minutes = adjustedDate.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (e) {
        console.error("Error formatting datetime:", e, "Input:", dateTimeString);
        return '';
    }
};

// formatTimeFromDateTime was unused
/*
const formatTimeFromDateTime = (dateTimeString) => {
    if (!dateTimeString) return 'N/A';
    try {
      const date = new Date(dateTimeString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      console.error("Error formatting time from datetime:", e, "Input:", dateTimeString);
      return 'N/A';
    }
};
*/

// --- File Upload Helpers ---
const uploadFileToSupabase = async (file, bucketName, pathPrefix = '') => {
    if (!file) {
        console.error("uploadFileToSupabase: No file provided.");
        return null;
    }
    const safeBaseName = typeof file.name === 'string' ? file.name.replace(/\s+/g, '_') : 'uploaded_file';
    const resolvedPathPrefix = pathPrefix && !pathPrefix.endsWith('/') ? `${pathPrefix}/` : pathPrefix;
    const fileName = `${resolvedPathPrefix}${Date.now()}_${safeBaseName}`;

    try {
        const { /*data: _uploadData,*/ error: uploadError } = await supabase.storage // _uploadData if data is not used
            .from(bucketName)
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            console.error('Supabase Storage Upload Error Object:', uploadError);
            throw uploadError;
        }

        const { data: publicUrlData, error: urlError } = supabase.storage
            .from(bucketName)
            .getPublicUrl(fileName);

        if (urlError) {
            console.error('Supabase Storage Get Public URL Error Object:', urlError);
            throw urlError;
        }
        
        if (!publicUrlData || !publicUrlData.publicUrl) {
            console.error('Error getting public URL for:', fileName, 'Public URL Data:', publicUrlData);
            throw new Error('Could not get public URL for uploaded file.');
        }
        return { publicUrl: publicUrlData.publicUrl, filePath: fileName, fileSize: file.size, mimeType: file.type };

    } catch (error) {
        console.error('File upload process failed overall:', error.message);
        throw error; 
    }
};

const uploadReportPhoto = async (file, childId, photoNumber) => {
    if (!file) return null;
    const BUCKET_NAME = 'galleryfiles'; 
    const pathPrefix = `daily-reports/${childId}/report_${photoNumber}`; 
    try {
        const uploadResult = await uploadFileToSupabase(file, BUCKET_NAME, pathPrefix);
        return uploadResult?.publicUrl || null;
    } catch (error) {
        console.error('Report photo upload process failed:', error.message, error);
        return null; 
    }
};


// --- Reusable Helper Components ---
const Modal = ({ children, onClose, title, size = "large" }) => (
  <div className="modal-overlay">
    <div className={`modal-content modal-size-${size}`}>
      <div className="modal-header">
        <h3 className="modal-title">{title}</h3>
        <button onClick={onClose} className="modal-close-button"> <X size={22} /> </button>
      </div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
);
const InputField = ({ label, id, name, type = "text", value, onChange, required, placeholder, disabled, icon: Icon, step, min, max, accept }) => (
  <div className="input-group">
    <label htmlFor={id || name} className="input-label">{label}{required && <span className="required-asterisk">*</span>}</label>
    <div className="input-wrapper">
      {Icon && <Icon className="input-icon" size={18} />}
      <input type={type} id={id || name} name={name} value={value === null || value === undefined ? '' : value} onChange={onChange} required={required} placeholder={placeholder} disabled={disabled} step={step} min={min} max={max} accept={accept}
              className={`input-field ${Icon ? 'input-field-with-icon' : ''} ${type === 'file' ? 'input-field-file' : ''}`} />
    </div>
  </div>
);
const TextAreaField = ({ label, id, name, value, onChange, required, placeholder, rows = 3, disabled }) => (
  <div className="input-group">
    <label htmlFor={id || name} className="input-label">{label}{required && <span className="required-asterisk">*</span>}</label>
    <textarea id={id || name} name={name} value={value} onChange={onChange} required={required} placeholder={placeholder} rows={rows} disabled={disabled}
              className="textarea-field" />
  </div>
);
const SelectField = ({ label, id, name, value, onChange, required, children, disabled, icon: Icon }) => (
    <div className="input-group">
        <label htmlFor={id || name} className="input-label">{label}{required && <span className="required-asterisk">*</span>}</label>
        <div className="input-wrapper">
            {Icon && <Icon className="input-icon" size={18} />}
            <select id={id || name} name={name} value={value} onChange={onChange} required={required} disabled={disabled}
                    className={`input-field select-field ${Icon ? 'input-field-with-icon' : ''}`}>
                {children}
            </select>
        </div>
    </div>
);
const CheckboxField = ({ label, id, name, checked, onChange, disabled }) => (
    <div className="input-group input-group-checkbox">
        <input type="checkbox" id={id || name} name={name} checked={checked} onChange={onChange} disabled={disabled} className="checkbox-field" />
        <label htmlFor={id || name} className="checkbox-label">{label}</label>
    </div>
);
const FormActions = ({ onCancel, submitText = "Submit", cancelText = "Cancel", submitIcon: SubmitIcon, loading, disabled }) => (
  <div className="form-actions">
    <button type="button" onClick={onCancel} disabled={loading} className="btn btn-secondary"> {cancelText} </button>
    <button type="submit" className="btn btn-primary" disabled={loading || disabled}>
      {loading ? <Clock size={18} className="animate-spin-css" /> : SubmitIcon && <SubmitIcon size={18} />}
      <span style={{marginLeft: loading || SubmitIcon ? '8px' : '0'}}>{loading ? "Processing..." : submitText}</span>
    </button>
  </div>
);
const InfoMessage = ({ message, type = "info", icon: Icon }) => (
  <div className={`info-message info-message-${type}`}>
    {Icon && <Icon size={20} className="info-message-icon"/>}
    <span>{message}</span>
  </div>
);

// --- PAGE AND MODAL COMPONENT DEFINITIONS ---

// --- DASHBOARD COMPONENTS ---
const StatCardItem = ({ icon: Icon, value, label, color, targetPage, setCurrentPage }) => (
  <button
    className={`stat-card-item page-card-item interactive-card ${targetPage ? 'cursor-pointer' : ''}`}
    onClick={targetPage && setCurrentPage ? () => setCurrentPage(targetPage) : undefined}
    title={targetPage ? `Go to ${label}` : `${value} ${label}`}
  >
    {Icon && <Icon size={28} className={`stat-icon ${color || 'text-blue-600'}`} />}
    <div className={`stat-value ${color || 'text-blue-600'}`}>{value}</div>
    <div className="stat-label">{label}</div>
  </button>
);

const QuickActionItem = ({ icon: Icon, label, count, subtext, onClick, pageName }) => (
  <button
    className="quick-action-item page-card-item interactive-card"
    onClick={onClick}
    title={`Navigate to ${label}`}
  >
    <div className="quick-action-header">
      {Icon && <Icon size={24} className="quick-action-icon text-indigo-600" />}
      <span className="quick-action-label">{label}</span>
    </div>
    {(typeof count !== 'undefined') && (
      <div className="quick-action-count">
        {count}
        {subtext && <span className="quick-action-subtext"> {subtext}</span>}
      </div>
    )}
  </button>
);

const AdminDashboardPage = () => {
  const {
    currentUser,
    children,
    staff,
    rooms,
    incidentReports,
    invoices,
    waitlistEntries,
    announcements, 
    setCurrentPage 
  } = React.useContext(AppStateContext);

  const totalChildren = children?.length || 0;
  const totalStaff = staff?.length || 0;
  const totalRooms = rooms?.length || 0;
  const openIncidents = incidentReports?.filter(ir => ir.status?.toLowerCase() === 'open').length || 0;
  const unpaidInvoicesCount = invoices?.filter(inv => ['unpaid', 'overdue'].includes(inv.status?.toLowerCase())).length || 0;
  const waitlistCount = waitlistEntries?.length || 0;
  const publishedAnnouncements = announcements?.filter(an => an.is_published).length || 0;


  const quickActionsList = [
    { label: "Manage Children", page: 'Children', icon: Smile, count: totalChildren },
    { label: "Manage Staff", page: 'Staff', icon: UsersIconAliased, count: totalStaff },
    { label: "View Daily Reports", page: 'AdminDailyReports', icon: FileText },
    { label: "Manage Announcements", page: 'AdminAnnouncements', icon: Megaphone, count: publishedAnnouncements, subtext: "Published" },
    { label: "Handle Billing", page: 'AdminBilling', icon: DollarSign, count: unpaidInvoicesCount, subtext: "Unpaid" },
    { label: "Manage Waitlist", page: 'AdminWaitlist', icon: ListOrdered, count: waitlistCount },
    { label: "Log Incident", page: 'LogIncidentPage', icon: ShieldAlert },
    { label: "Manage Rooms", page: 'Rooms', icon: Building, count: totalRooms },
  ];

  return (
    <div className="page-card admin-dashboard">
      <InfoMessage icon={HomeIcon} message={`Welcome back, ${currentUser?.name || 'Admin'}! Let's manage the daycare.`} type="info" />

      <h2 className="dashboard-section-title">At a Glance</h2>
      <div className="stats-grid">
        <StatCardItem icon={Smile} value={totalChildren} label="Total Children" setCurrentPage={setCurrentPage} targetPage="Children" />
        <StatCardItem icon={UsersIconAliased} value={totalStaff} label="Total Staff" setCurrentPage={setCurrentPage} targetPage="Staff" />
        <StatCardItem icon={Building} value={totalRooms} label="Total Rooms" setCurrentPage={setCurrentPage} targetPage="Rooms"/>
        <StatCardItem icon={ShieldAlert} value={openIncidents} label="Open Incidents" color="text-red-600" setCurrentPage={setCurrentPage} targetPage="AdminIncidentReports" />
        <StatCardItem icon={DollarSign} value={unpaidInvoicesCount} label="Unpaid Invoices" color="text-orange-600" setCurrentPage={setCurrentPage} targetPage="AdminBilling" />
        <StatCardItem icon={ListOrdered} value={waitlistCount} label="On Waitlist" setCurrentPage={setCurrentPage} targetPage="AdminWaitlist" />
      </div>

      <h2 className="dashboard-section-title">Quick Actions</h2>
      <div className="quick-actions-grid">
        {quickActionsList.map(action => (
          <QuickActionItem
            key={action.page}
            icon={action.icon}
            label={action.label}
            count={action.count}
            subtext={action.subtext}
            onClick={() => setCurrentPage(action.page)}
            pageName={action.page}
          />
        ))}
      </div>
    </div>
  );
};

const TeacherDashboardPage = () => {
    const { currentUser, setCurrentPage } = React.useContext(AppStateContext);
    return (
        <div className="page-card admin-dashboard"> 
            <InfoMessage icon={Briefcase} message={`Welcome, ${currentUser?.name || 'Teacher'}!`} type="info"/>
            <h2 className="dashboard-section-title">Your Focus Today</h2>
            <div className="quick-actions-grid">
                <QuickActionItem
                    icon={FileText}
                    label="View/Create Daily Reports"
                    onClick={() => setCurrentPage('AdminDailyReports')} 
                />
                 <QuickActionItem
                    icon={Camera}
                    label="View Photo Gallery"
                    onClick={() => setCurrentPage('AdminGallery')} 
                />
                <QuickActionItem
                    icon={Megaphone}
                    label="View Announcements"
                    onClick={() => setCurrentPage('AdminAnnouncements')} 
                />
            </div>
        </div>
    );
};
const AssistantDashboardPage = () => <div className="page-card"><InfoMessage message="Assistant Dashboard - Welcome!" icon={UsersIconAliased}/></div>;

const ParentDashboardPage = ({ currentUser }) => {
    const { children, dailyReports, rooms, setCurrentPage } = React.useContext(AppStateContext);
    const [myChildren, setMyChildren] = useState([]);
    const [reportCounts, setReportCounts] = useState({});

    useEffect(() => {
        if (currentUser && currentUser.role === 'parent' && currentUser.profileId && Array.isArray(children)) {
            const filteredChildren = children.filter(c => c.primary_parent_id === currentUser.profileId);
            setMyChildren(filteredChildren);

            if (Array.isArray(dailyReports) && filteredChildren.length > 0) {
                const counts = {};
                filteredChildren.forEach(child => {
                    counts[child.id] = dailyReports.filter(report => report.child_id === child.id).length;
                });
                setReportCounts(counts);
            }
        } else {
            setMyChildren([]);
            setReportCounts({});
        }
    }, [currentUser, children, dailyReports]);

    return (
        <div className="page-card admin-dashboard">
            <InfoMessage message={`Welcome, ${currentUser?.name || 'Parent'}!`} icon={Smile} type="info"/>
            
            <h3 className="dashboard-section-title" style={{ marginTop: '20px' }}>Your Children</h3>
            {myChildren.length > 0 ? (
                <ul className="content-list">
                    {myChildren.map(child => {
                        const isCheckedIn = child.check_in_time && !child.check_out_time;
                        const statusText = isCheckedIn ? 'Checked In' : 'Checked Out';
                        const statusClass = isCheckedIn ? 'status-badge-green' : 'status-badge-red';

                        return (
                            <li key={child.id} className="content-list-item page-card-item">
                                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap'}}>
                                    <span>
                                        <strong>{child.name}</strong> (Age: {child.age || 'N/A'})
                                    </span>
                                    <div className="child-status-badges" style={{display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px', flexShrink: 0}}>
                                        <span className={`status-badge ${statusClass}`}>
                                            {isCheckedIn ? <LogIn size={14} style={{marginRight: '5px'}}/> : <LogOut size={14} style={{marginRight: '5px'}}/>}
                                            {statusText}
                                        </span>
                                        <span className="status-badge status-badge-blue">
                                            <BookCopy size={14} style={{marginRight: '5px'}}/>
                                            {reportCounts[child.id] || 0} Reports
                                        </span>
                                    </div>
                                </div>
                                {child.current_room_id && Array.isArray(rooms) && rooms.find(r => r.id === child.current_room_id) && (
                                    <p style={{fontSize: '0.9em', color: '#555', marginTop: '5px'}}>
                                        Room: {rooms.find(r => r.id === child.current_room_id)?.name || 'N/A'}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            ) : (
                <p>No children linked to your profile. Please contact administration if this is an error.</p>
            )}

            <h2 className="dashboard-section-title">Quick Access</h2>
              <div className="quick-actions-grid">
                <QuickActionItem
                    icon={FileText}
                    label="View Daily Reports"
                    onClick={() => setCurrentPage('ParentDailyReports')}
                />
                <QuickActionItem
                    icon={DollarSign}
                    label="View Invoices"
                    onClick={() => setCurrentPage('ParentInvoices')}
                />
                <QuickActionItem
                    icon={Camera}
                    label="Photo Gallery"
                    onClick={() => setCurrentPage('AdminGallery')} 
                />
                 <QuickActionItem
                    icon={Megaphone}
                    label="Announcements"
                    onClick={() => setCurrentPage('AdminAnnouncements')} 
                />
            </div>
        </div>
    );
};
const UnknownRolePage = () => <div className="page-card"><InfoMessage message="Your account is active, but your role is not yet assigned or recognized. Please contact an administrator for assistance." type="warning" icon={AlertTriangle}/></div>;

// --- AUTH PAGE ---
const AuthPage = ({ onSignUp, onSignIn, loading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningUp, setIsSigningUp] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const handleSubmit = (e) => { e.preventDefault(); if (!email || !password) { alert("Email and password are required."); return; } if (isSigningUp) { onSignUp(email, password); } else { onSignIn(email, password); } };
  return ( 
    <div className="auth-page-container"> 
      <div className="auth-card"> 
        <div className="auth-logo-wrapper" style={{ textAlign: 'center', marginBottom: '20px' }}>
            <img 
                src="/evergreen-logo-2.png" 
                alt="Evergreen Tots App Logo" 
                className="auth-logo-image" 
                style={{ maxWidth: '150px', height: 'auto' }} 
            />
        </div>
        <div className="auth-header"> 
          <h1 className="auth-title">{isSigningUp ? 'Create Your Account' : 'Welcome Back'}</h1> 
          <p className="auth-subtitle">{isSigningUp ? 'Join our daycare community today.' : 'Sign in to manage your daycare activities.'}</p> 
        </div> 
        <form onSubmit={handleSubmit} className="auth-form"> 
          <InputField label="Email Address" id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" icon={Mail}/> 
          <div className="input-group"> 
            <label htmlFor="password" className="input-label">Password</label> 
            <div className="input-wrapper input-wrapper-password"> 
              <Lock className="input-icon" size={18}/> 
              <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={isSigningUp ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="input-field input-field-with-icon" placeholder="••••••••"/> 
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="password-toggle-button" title={showPassword ? "Hide password" : "Show password"}> {showPassword ? <EyeOff size={20} /> : <Eye size={20} />} </button> 
            </div> 
          </div> 
          <button type="submit" disabled={loading} className="btn btn-primary btn-full-width auth-submit-button">
            {loading ? <Clock size={20} className="animate-spin-css" /> : isSigningUp ? <UserPlus size={20} /> : <LogIn size={20} />}
            <span style={{marginLeft: '8px'}}>{loading ? 'Processing...' : isSigningUp ? 'Sign Up' : 'Sign In'}</span> 
          </button> 
        </form> 
        <p className="auth-toggle-text"> 
          {isSigningUp ? 'Already have an account?' : "Don't have an account?"}{' '} 
          <button onClick={() => setIsSigningUp(!isSigningUp)} className="auth-toggle-link"> 
            {isSigningUp ? 'Sign In Here' : 'Create an Account'} 
          </button> 
        </p> 
      </div> 
    </div> 
  );
};

// --- CHILDREN COMPONENTS ---
const ChildrenPage = ({ childrenList, loading, onNavigateToAddChild, onEditChild, onDeleteChild, onToggleCheckIn, onNavigateToChildMedications }) => {
  if (loading && (!Array.isArray(childrenList) || childrenList.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading children...</div>;
  return (
    <div className="page-card">
      <div className="page-card-header"> <h2 className="page-card-title">Manage Children</h2> <button onClick={onNavigateToAddChild} className="btn btn-primary btn-small"><UserPlus size={18} /> Add New Child</button> </div>
      {(!loading && (!Array.isArray(childrenList) || childrenList.length === 0)) ? ( <InfoMessage message="No children records found. Add a new child to get started." icon={Smile}/> ) : (
        <div className="table-container"> <table className="data-table">
            <thead><tr><th className="th-cell">Name</th><th className="th-cell th-sm-hidden">Age</th><th className="th-cell th-md-hidden">Parent</th><th className="th-cell th-md-hidden">Status</th><th className="th-cell th-actions">Actions</th></tr></thead>
            <tbody>
              {Array.isArray(childrenList) && childrenList.map(child => {
                const isCheckedIn = child.check_in_time && !child.check_out_time;
                const parentDisplay = child.parents ? `${child.parents.first_name || ''} ${child.parents.last_name || ''}`.trim() : 'N/A';
                return (
                  <tr key={child.id} className="table-row">
                    <td className="td-cell td-name">{child.name}</td><td className="td-cell td-sm-hidden">{child.age}</td><td className="td-cell td-md-hidden">{parentDisplay}</td>
                    <td className="td-cell td-md-hidden"><span className={`status-badge ${isCheckedIn ? 'status-badge-green' : 'status-badge-red'}`}>{isCheckedIn ? 'Checked In' : 'Checked Out'}</span></td>
                    <td className="td-cell td-actions">
                      <button onClick={() => onToggleCheckIn(child.id)} className={`btn-icon table-action-button ${ isCheckedIn ? 'check-out' : 'check-in'}`} title={isCheckedIn ? 'Check Out' : 'Check In'}>{isCheckedIn ? <LogOut size={16}/> : <LogIn size={16}/>}</button>
                      <button onClick={() => onEditChild(child)} className="btn-icon table-action-button edit" title="Edit"><Edit3 size={16}/></button>
                      <button onClick={() => onNavigateToChildMedications(child)} className="btn-icon table-action-button" title="Manage Medications"><Pill size={16}/></button>
                      <button onClick={() => onDeleteChild(child.id)} className="btn-icon table-action-button delete" title="Delete"><Trash2 size={16}/></button>
                    </td></tr>);})}
            </tbody></table></div>)}</div>);
};

const AddChildPage = ({ onAddChild, onCancel, showAlert, parentsList, rooms }) => {
  const [formData, setFormData] = useState({
    name: '', age: null, primary_parent_id: '', current_room_id: '', emergency_contact: '',
    allergies: '', notes: '', medical_info: {}, authorized_pickups: [], billing: {}
  });
  const [parentSearchTerm, setParentSearchTerm] = useState('');
  const [filteredParents, setFilteredParents] = useState([]);
  const [selectedParentName, setSelectedParentName] = useState('');
  const handleChange = (e) => { const { name, value, type } = e.target; const val = type === 'number' ? (value === '' ? null : parseInt(value, 10)) : value; setFormData(prev => ({ ...prev, [name]: val })); };
  const handleJsonChange = (e, field) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [field]: { ...prev[field], [name]: value } })); };
  const handleParentSearchChange = (e) => {
    const term = e.target.value; setParentSearchTerm(term);
    if (term.length > 1) { setFilteredParents((Array.isArray(parentsList) ? parentsList : []).filter(p => `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(term.toLowerCase()) || (p.email || '').toLowerCase().includes(term.toLowerCase())).slice(0, 5));}
    else { setFilteredParents([]); }
    if (term === '') { setFormData(prev => ({ ...prev, primary_parent_id: '' })); setSelectedParentName('');}
  };
  const handleSelectParent = (parent) => { setFormData(prev => ({ ...prev, primary_parent_id: parent.id })); setSelectedParentName(`${parent.first_name} ${parent.last_name} (${parent.email})`); setParentSearchTerm(`${parent.first_name} ${parent.last_name}`); setFilteredParents([]); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || formData.age === null || !formData.primary_parent_id) { showAlert("Child's Name, Age, and Primary Parent are required.", "error"); return; }
    const { parent_first_name, parent_last_name, parent_email, parent_phone_number, ...childDataToSubmit } = formData;
    onAddChild(childDataToSubmit);
  };
  return (
    <div className="page-card form-page-card">
      <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Children</button>
      <h2 className="page-card-title form-page-title">Add New Child</h2>
      <form onSubmit={handleSubmit} className="form-layout">
        <h3 className="form-section-title">Child Information</h3>
        <InputField label="Child's Full Name" id="name" name="name" value={formData.name} onChange={handleChange} required />
        <InputField label="Child's Age" id="age" name="age" type="number" value={formData.age === null ? '' : formData.age} onChange={handleChange} required />
        <SelectField label="Assign to Room" id="current_room_id" name="current_room_id" value={formData.current_room_id || ''} onChange={handleChange} icon={Building} >
            <option value="">Select a Room (Optional)</option>
            {Array.isArray(rooms) && rooms.map(room => (<option key={room.id} value={room.id}>{room.name}</option>))}
        </SelectField>
        <h3 className="form-section-title">Primary Parent/Guardian</h3>
        <div className="input-group">
            <InputField label="Search for Parent (Name or Email)" id="parentSearch" name="parentSearch" value={parentSearchTerm} onChange={handleParentSearchChange} icon={Search} placeholder="Type to search..." />
            {filteredParents.length > 0 && (<ul className="search-results-list">{filteredParents.map(parent => (<li key={parent.id} onClick={() => handleSelectParent(parent)} className="search-result-item">{`${parent.first_name} ${parent.last_name}`} ({parent.email})</li>))}</ul>)}
            {formData.primary_parent_id && selectedParentName && (<InfoMessage type="success" message={`Selected Parent: ${selectedParentName}`} icon={UserCheck}/>)}
            {!formData.primary_parent_id && parentSearchTerm.length > 1 && filteredParents.length === 0 && (<InfoMessage type="warning" message="No parent found. Add parent via 'Manage Parents' tab first." />)}
        </div>
        <h3 className="form-section-title">Additional Child Information</h3>
        <InputField label="Emergency Contact (Name & Phone)" id="emergency_contact" name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} />
        <TextAreaField label="Allergies" id="allergies" name="allergies" value={formData.allergies} onChange={handleChange} />
        <TextAreaField label="General Notes" id="notes" name="notes" value={formData.notes} onChange={handleChange} />
        <h3 className="form-section-title">Medical Information</h3>
        <InputField label="Doctor's Name" name="doctorName" value={formData.medical_info.doctorName || ''} onChange={(e) => handleJsonChange(e, 'medical_info')} />
        <InputField label="Doctor's Phone" name="doctorPhone" value={formData.medical_info.doctorPhone || ''} onChange={(e) => handleJsonChange(e, 'medical_info')} />
        <TextAreaField label="Known Conditions" name="conditions" value={formData.medical_info.conditions || ''} onChange={(e) => handleJsonChange(e, 'medical_info')} />
        <FormActions onCancel={onCancel} submitText="Add Child" submitIcon={PlusCircle} />
      </form>
    </div>
  );
};

const EditChildModal = ({ child, onClose, onUpdateChild, parentsList, showAlert, rooms }) => {
  const [formData, setFormData] = useState({ name: child?.name || '', age: (child?.age === null || child?.age === undefined) ? '' : child.age, primary_parent_id: child?.primary_parent_id || '', current_room_id: child?.current_room_id || '', emergency_contact: child?.emergency_contact || '', allergies: child?.allergies || '', notes: child?.notes || '', medical_info: child?.medical_info || { doctorName: '', doctorPhone: '', conditions: ''}, authorized_pickups: child?.authorized_pickups || [], billing: child?.billing || { monthly_fee: '' } });
  const [parentSearchTerm, setParentSearchTerm] = useState(''); const [filteredParents, setFilteredParents] = useState([]); const [selectedParentName, setSelectedParentName] = useState('');
  useEffect(() => {
    if (child) {
        setFormData({ name: child.name || '', age: (child.age === null || child.age === undefined) ? '' : child.age, primary_parent_id: child.primary_parent_id || '', current_room_id: child.current_room_id || '', emergency_contact: child.emergency_contact || '', allergies: child.allergies || '', notes: child.notes || '', medical_info: child.medical_info || { doctorName: '', doctorPhone: '', conditions: ''}, authorized_pickups: child.authorized_pickups || [], billing: child.billing || { monthly_fee: '' } });
        if (child.primary_parent_id && Array.isArray(parentsList) && parentsList.length > 0) { const linkedParent = parentsList.find(p => p.id === child.primary_parent_id); if (linkedParent) { setSelectedParentName(`${linkedParent.first_name} ${linkedParent.last_name} (${linkedParent.email})`); setParentSearchTerm(`${linkedParent.first_name} ${linkedParent.last_name}`); }}
        else if (child.parents) { setSelectedParentName(`${child.parents.first_name || ''} ${child.parents.last_name || ''} (${child.parents.email || ''})`.trim()); setParentSearchTerm(`${child.parents.first_name || ''} ${child.parents.last_name || ''}`.trim());}
    }
  }, [child, parentsList]);
  const handleChange = (e) => { const { name, value, type } = e.target; const val = type === 'number' ? (value === '' ? null : parseInt(value, 10)) : value; setFormData(prev => ({ ...prev, [name]: val })); };
  const handleJsonChange = (e, field) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [field]: { ...prev[field], [name]: value } })); };
  const handleParentSearchChangeOnEdit = (e) => {
    const term = e.target.value; setParentSearchTerm(term);
    if (term.length > 1 && Array.isArray(parentsList)) { setFilteredParents( parentsList.filter(p => `${p.first_name || ''} ${p.last_name || ''}`.toLowerCase().includes(term.toLowerCase()) || (p.email || '').toLowerCase().includes(term.toLowerCase())).slice(0, 5));}
    else { setFilteredParents([]); }
    if (term === '') { setFormData(prev => ({ ...prev, primary_parent_id: '' })); setSelectedParentName('');}
  };
  const handleSelectParentOnEdit = (parent) => { setFormData(prev => ({ ...prev, primary_parent_id: parent.id })); setSelectedParentName(`${parent.first_name} ${parent.last_name} (${parent.email})`); setParentSearchTerm(`${parent.first_name} ${parent.last_name}`); setFilteredParents([]); };
  const handleSubmit = (e) => { e.preventDefault(); if (!formData.name || formData.age === null ) { showAlert("Name and Age are required.", "error"); return; } if (!formData.primary_parent_id) { showAlert("A Primary Parent must be selected.", "error"); return; } onUpdateChild({ ...formData, id: child.id }); };
  if (!child) return null;
  return (
    <Modal onClose={onClose} title={`Edit ${child.name || 'Child'}`} size="large">
        <form onSubmit={handleSubmit} className="form-layout modal-form">
            <InputField label="Full Name" id="edit_name" name="name" value={formData.name} onChange={handleChange} required />
            <InputField label="Age" id="edit_age" name="age" type="number" value={formData.age === null ? '' : formData.age} onChange={handleChange} required />
            <SelectField label="Assigned Room" id="edit_current_room_id" name="current_room_id" value={formData.current_room_id || ''} onChange={handleChange} icon={Building} >
                <option value="">Select a Room (Optional)</option>
                {Array.isArray(rooms) && rooms.map(room => (<option key={room.id} value={room.id}>{room.name}</option>))}
            </SelectField>
            <h3 className="form-section-title">Primary Parent/Guardian</h3>
            <div className="input-group">
                <InputField label="Search/Change Parent (Name or Email)" id="parentSearchEdit" name="parentSearchEdit" value={parentSearchTerm} onChange={handleParentSearchChangeOnEdit} icon={Search} placeholder="Type to search..." />
                {filteredParents.length > 0 && (<ul className="search-results-list">{filteredParents.map(p => ( <li key={p.id} onClick={() => handleSelectParentOnEdit(p)} className="search-result-item"> {`${p.first_name} ${p.last_name}`} ({p.email}) </li> ))}</ul>)}
                {formData.primary_parent_id && selectedParentName && ( <InfoMessage type="success" message={`Selected Parent: ${selectedParentName}`} icon={UserCheck}/> )}
                {!formData.primary_parent_id && parentSearchTerm.length > 1 && filteredParents.length === 0 && ( <InfoMessage type="warning" message="No parent found. Add parent via 'Manage Parents' tab first." /> )}
            </div>
            <InputField label="Emergency Contact" name="emergency_contact" value={formData.emergency_contact} onChange={handleChange} />
            <TextAreaField label="Allergies" id="edit_allergies" name="allergies" value={formData.allergies} onChange={handleChange} />
            <TextAreaField label="Notes" id="edit_notes" name="notes" value={formData.notes} onChange={handleChange} />
            <h3 className="form-section-title">Medical Information</h3>
            <InputField label="Doctor's Name" name="doctorName" value={formData.medical_info.doctorName || ''} onChange={(e) => handleJsonChange(e, 'medical_info')} />
            <InputField label="Doctor's Phone" name="doctorPhone" value={formData.medical_info.doctorPhone || ''} onChange={(e) => handleJsonChange(e, 'medical_info')} />
            <TextAreaField label="Known Conditions" name="conditions" value={formData.medical_info.conditions || ''} onChange={(e) => handleJsonChange(e, 'medical_info')} />
            <h3 className="form-section-title">Billing</h3>
            <InputField label="Monthly Fee" name="monthly_fee" type="number" value={formData.billing.monthly_fee || ''} onChange={(e) => handleJsonChange(e, 'billing')} />
            <FormActions onCancel={onClose} submitText="Save Changes" submitIcon={CheckCircle} />
        </form>
    </Modal>
  );
};

// --- STAFF COMPONENTS ---
const StaffPage = ({ staffList, loading, onNavigateToAddStaff, onEditStaff, onDeleteStaff, rooms }) => {
    if (loading && (!Array.isArray(staffList) || staffList.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading staff...</div>;
    const roomNameMap = Array.isArray(rooms) ? rooms.reduce((acc, room) => { acc[room.id] = room.name; return acc; }, {}) : {};
    return ( <div className="page-card"> <div className="page-card-header"> <h2 className="page-card-title">Manage Staff</h2> <button onClick={onNavigateToAddStaff} className="btn btn-primary btn-small"><UserPlus size={18}/> Add New Staff</button> </div> {(!loading && (!Array.isArray(staffList) || staffList.length === 0)) ? (<InfoMessage message="No staff records found." icon={UsersIconAliased}/>) : ( <div className="table-container"> <table className="data-table"><thead><tr><th className="th-cell">Name</th><th className="th-cell">Role</th><th className="th-cell th-sm-hidden">Main Room</th><th className="th-cell th-md-hidden">Email</th><th className="th-cell th-lg-hidden">Phone</th><th className="th-cell th-actions">Actions</th></tr></thead><tbody>{Array.isArray(staffList) && staffList.map(staffMember => (<tr key={staffMember.id} className="table-row"><td className="td-cell td-name">{staffMember.name}</td><td className="td-cell">{staffMember.role}</td><td className="td-cell th-sm-hidden">{(staffMember.role === 'teacher') && staffMember.main_room_id ? roomNameMap[staffMember.main_room_id] || 'N/A' : 'N/A'}</td><td className="td-cell td-md-hidden">{staffMember.email}</td><td className="td-cell td-lg-hidden">{staffMember.contact_phone}</td><td className="td-cell td-actions"><button onClick={() => onEditStaff(staffMember)} className="btn-icon table-action-button edit" title="Edit"><Edit3 size={16}/></button><button onClick={() => onDeleteStaff(staffMember.id)} className="btn-icon table-action-button delete" title="Delete"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>)}</div>);
};
const AddStaffPage = ({ onAddStaff, onCancel, currentUser, showAlert, rooms }) => {
    const [formData, setFormData] = useState({ name: '', email: '', role: '', contact_phone: '', qualifications: '', emergency_contact_name: '', emergency_contact_phone:'', notes: '', user_id: null, main_room_id: '', });
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value,
            ...(name === 'role' && value !== 'teacher' && { main_room_id: '' }) 
        }));
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.name || !formData.role) { showAlert("Name and Role are required.", "error"); return; }
        if (formData.role === 'teacher' && !formData.main_room_id) { 
            showAlert("A Main Room must be selected for a teacher.", "error"); 
            return;
        }
        const dataToSubmit = {...formData, user_id: formData.email === currentUser?.email ? currentUser.id : null };
        onAddStaff(dataToSubmit);
    };
    return (
    <div className="page-card form-page-card">
        <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Staff</button>
        <h2 className="page-card-title form-page-title">Add New Staff Member</h2>
        <form onSubmit={handleSubmit} className="form-layout">
            <InputField label="Full Name" name="name" value={formData.name} onChange={handleChange} required icon={UserCircle2}/>
            <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} icon={Mail}/>
            <SelectField label="Role" name="role" value={formData.role} onChange={handleChange} required icon={Award}>
                <option value="">Select Role</option>
                <option value="teacher">teacher</option>
                <option value="assistant">assistant</option>
                <option value="admin">admin</option>
            </SelectField>
            {formData.role === 'teacher' && (
                <SelectField label="Main Room" name="main_room_id" value={formData.main_room_id} onChange={handleChange} required icon={Building}>
                    <option value="">Select Main Room</option>
                    {Array.isArray(rooms) && rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
                </SelectField>
            )}
            <InputField label="Contact Phone" name="contact_phone" type="tel" value={formData.contact_phone} onChange={handleChange} icon={Phone}/>
            <TextAreaField label="Qualifications" name="qualifications" value={formData.qualifications} onChange={handleChange} />
            <InputField label="Emergency Contact Name" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange}/>
            <InputField label="Emergency Contact Phone" name="emergency_contact_phone" type="tel" value={formData.emergency_contact_phone} onChange={handleChange}/>
            <TextAreaField label="Notes" name="notes" value={formData.notes} onChange={handleChange}/>
            <FormActions onCancel={onCancel} submitText="Add Staff" submitIcon={UserPlus}/>
    </form></div>);
};
const EditStaffModal = ({ staffMember, onClose, onUpdateStaff, showAlert, rooms }) => {
  const [formData, setFormData] = useState({ name: staffMember?.name || '', email: staffMember?.email || '', role: staffMember?.role || '', contact_phone: staffMember?.contact_phone || '', qualifications: staffMember?.qualifications || '', emergency_contact_name: staffMember?.emergency_contact_name || '', emergency_contact_phone: staffMember?.emergency_contact_phone || '', notes: staffMember?.notes || '', main_room_id: staffMember?.main_room_id || '', });
  useEffect(() => { if (staffMember) { setFormData({ name: staffMember.name || '', email: staffMember.email || '', role: staffMember.role || '', contact_phone: staffMember.contact_phone || '', qualifications: staffMember.qualifications || '', emergency_contact_name: staffMember.emergency_contact_name || '', emergency_contact_phone: staffMember.emergency_contact_phone || '', notes: staffMember.notes || '', main_room_id: staffMember.main_room_id || '', }); } }, [staffMember]);
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
        ...prev,
        [name]: value,
        ...(name === 'role' && value !== 'teacher' && { main_room_id: '' }) 
    }));
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.role) { showAlert("Name and Role are required.", "error"); return; }
    if (formData.role === 'teacher' && !formData.main_room_id) { 
        showAlert("A Main Room must be selected for a teacher.", "error"); 
        return;
    }
    const dataToUpdate = { ...formData };
    onUpdateStaff({ ...dataToUpdate, id: staffMember.id });
  };
  if (!staffMember) return null;
  return (
    <Modal onClose={onClose} title={`Edit ${staffMember.name || 'Staff Member'}`} size="medium">
        <form onSubmit={handleSubmit} className="form-layout modal-form">
            <InputField label="Full Name" name="name" value={formData.name} onChange={handleChange} required icon={UserCircle2} />
            <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} icon={Mail} />
            <SelectField label="Role" name="role" value={formData.role} onChange={handleChange} required icon={Award}>
                <option value="">Select Role</option>
                <option value="teacher">teacher</option>
                <option value="assistant">assistant</option>
                <option value="admin">admin</option>
            </SelectField>
            {(formData.role === 'teacher') && ( 
                <SelectField
                    label="Main Room" name="main_room_id" value={formData.main_room_id || ''} onChange={handleChange}
                    required={(formData.role === 'teacher')} 
                    icon={Building}>
                    <option value="">Select Main Room</option>
                    {Array.isArray(rooms) && rooms.map(room => <option key={room.id} value={room.id}>{room.name}</option>)}
                </SelectField>
            )}
            <InputField label="Contact Phone" name="contact_phone" type="tel" value={formData.contact_phone} onChange={handleChange} icon={Phone} />
            <TextAreaField label="Qualifications" name="qualifications" value={formData.qualifications} onChange={handleChange} />
            <InputField label="Emergency Contact Name" name="emergency_contact_name" value={formData.emergency_contact_name} onChange={handleChange} />
            <InputField label="Emergency Contact Phone" name="emergency_contact_phone" type="tel" value={formData.emergency_contact_phone} onChange={handleChange} />
            <TextAreaField label="Notes" name="notes" value={formData.notes} onChange={handleChange} />
            <FormActions onCancel={onClose} submitText="Save Changes" submitIcon={CheckCircle} />
        </form>
    </Modal>
  );
};

// --- ROOMS COMPONENTS ---
const RoomManagementPage = ({ rooms, loading, onNavigateToAddRoom, onEditRoom, onDeleteRoom }) => {
    if (loading && (!Array.isArray(rooms) || rooms.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading rooms...</div>;
    return ( <div className="page-card"> <div className="page-card-header"><h2 className="page-card-title">Manage Rooms</h2><button onClick={onNavigateToAddRoom} className="btn btn-primary btn-small"><PlusCircle size={18}/> Add New Room</button></div> {(!loading && (!Array.isArray(rooms) || rooms.length === 0)) ? (<InfoMessage message="No rooms found." icon={Building}/>) : ( <div className="rooms-grid">{Array.isArray(rooms) && rooms.map(room => (<div key={room.id} className="room-card"><h3 className="room-name">{room.name}</h3><p className="room-capacity"><UsersIconAliased size={14}/> Capacity: {room.capacity || 'N/A'}</p><div className="room-actions"><button onClick={() => onEditRoom(room)} className="btn-icon table-action-button edit" title="Edit"><Edit3 size={16}/></button><button onClick={() => onDeleteRoom(room.id)} className="btn-icon table-action-button delete" title="Delete"><Trash2 size={16}/></button></div></div>))}</div> )}</div>);
};
const AddRoomPage = ({ onAddRoom, onCancel }) => {
    const [formData, setFormData] = useState({ name: '', capacity: '' });
    const handleChange = (e) => { const { name, value, type } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? null : parseInt(value)) : value }));};
    const handleSubmit = (e) => { e.preventDefault(); if (!formData.name) { alert("Room name is required."); return; } onAddRoom(formData); };
    return ( <div className="page-card form-page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Rooms</button> <h2 className="page-card-title form-page-title">Add New Room</h2> <form onSubmit={handleSubmit} className="form-layout"> <InputField label="Room Name" name="name" value={formData.name} onChange={handleChange} required icon={Building} /> <InputField label="Capacity" name="capacity" type="number" value={formData.capacity === null ? '' : formData.capacity} onChange={handleChange} icon={UsersIconAliased} /> <FormActions onCancel={onCancel} submitText="Add Room" submitIcon={PlusCircle} /> </form></div>);
};
const EditRoomModal = ({ room, onClose, onUpdateRoom, showAlert }) => {
  const [formData, setFormData] = useState({ name: room?.name || '', capacity: room?.capacity === null || room?.capacity === undefined ? '' : room.capacity, });
  useEffect(() => { if (room) { setFormData({ name: room.name || '', capacity: room.capacity === null || room.capacity === undefined ? '' : room.capacity, }); } }, [room]);
  const handleChange = (e) => { const { name, value, type } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'number' ? (value === '' ? null : parseInt(value, 10)) : value })); };
  const handleSubmit = (e) => { e.preventDefault(); if (!formData.name) { showAlert("Room Name is required.", "error"); return; } onUpdateRoom({ ...formData, id: room.id }); };
  if (!room) return null;
  return ( <Modal onClose={onClose} title={`Edit ${room.name || 'Room'}`} size="medium"> <form onSubmit={handleSubmit} className="form-layout modal-form"> <InputField label="Room Name" name="name" value={formData.name} onChange={handleChange} required icon={Building} /> <InputField label="Capacity" name="capacity" type="number" value={formData.capacity === null ? '' : formData.capacity} onChange={handleChange} icon={UsersIconAliased} /> <FormActions onCancel={onClose} submitText="Save Changes" submitIcon={CheckCircle} /> </form> </Modal> );
};

// --- DAILY REPORTS COMPONENTS ---
const AdminDailyReportsPage = ({ dailyReports, loading, children, staff, onNavigateToCreateReport, onViewReportDetails }) => {
    if (loading && (!Array.isArray(dailyReports) || dailyReports.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading daily reports...</div>;
    const childNameMap = Array.isArray(children) ? children.reduce((acc, child) => { acc[child.id] = child.name; return acc; }, {}) : {};
    const staffNameMap = Array.isArray(staff) ? staff.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {}) : {};
    return ( <div className="page-card"> <div className="page-card-header"> <h2 className="page-card-title">Daily Reports</h2> {onNavigateToCreateReport && <button onClick={onNavigateToCreateReport} className="btn btn-primary btn-small"><PlusCircle size={18} /> Create Report</button>} </div> {(!loading && (!Array.isArray(dailyReports) || dailyReports.length === 0)) ? (<InfoMessage message="No daily reports found." icon={FileText}/>) : ( <div className="table-container"> <table className="data-table"><thead><tr><th className="th-cell">Date</th><th className="th-cell">Child</th><th className="th-cell th-sm-hidden">Mood</th><th className="th-cell th-md-hidden">Reported By</th><th className="th-cell th-actions">Actions</th></tr></thead><tbody>{Array.isArray(dailyReports) && dailyReports.map(report => (<tr key={report.id} className="table-row"><td className="td-cell">{formatDateForInput(report.report_date)}</td><td className="td-cell td-name">{childNameMap[report.child_id] || 'Unknown Child'}</td><td className="td-cell td-sm-hidden">{report.mood}</td><td className="td-cell td-md-hidden">{staffNameMap[report.staff_id] || 'Unknown Staff'}</td><td className="td-cell td-actions"><button onClick={() => onViewReportDetails(report)} className="btn-icon table-action-button" title="View Details"><Eye size={16}/></button></td></tr>))}</tbody></table></div>)}</div>);
};
const CreateDailyReportPage = ({ children, staff, onAddDailyReport, onCancel, currentUser, showAlert }) => {
    const [formData, setFormData] = useState({ child_id: '', report_date: formatDateForInput(new Date()), mood: 'Happy', meals: { breakfast: '', lunch: '', snack_am: '', snack_pm: '' }, naps: [{ start: '', end: '' }], activities: '', toileting_diapers: '', supplies_needed: '', notes_for_parents: '', });
    const [photo1File, setPhoto1File] = useState(null); const [photo2File, setPhoto2File] = useState(null); const [isUploading, setIsUploading] = useState(false);
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleMealChange = (e, mealName) => { const { value } = e.target; setFormData(prev => ({ ...prev, meals: { ...prev.meals, [mealName]: value }})); };
    const handleNapChange = (e, index, field) => { const newNaps = [...formData.naps]; newNaps[index][field] = e.target.value; setFormData(prev => ({ ...prev, naps: newNaps })); };
    const addNapField = () => setFormData(prev => ({ ...prev, naps: [...prev.naps, {start: '', end: ''}]}));
    const handleFileChange = (e, photoNumber) => { const file = e.target.files[0]; if (file) { if (photoNumber === 1) setPhoto1File(file); if (photoNumber === 2) setPhoto2File(file); } };
    const handleSubmit = async (e) => {
        e.preventDefault(); setIsUploading(true);
        if (!formData.child_id || !formData.report_date) { showAlert("Child and Report Date are required.", "error"); setIsUploading(false); return; }
        if (!currentUser?.id) { showAlert("Current user not found.", "error"); setIsUploading(false); return; }
        if (!Array.isArray(staff) || staff.length === 0) { showAlert("Staff data unavailable.", "error"); setIsUploading(false); return; }
        const currentStaffMember = staff.find(s => s.user_id === currentUser.id);
        if (!currentStaffMember) { showAlert("Matching staff profile not found.", "error"); setIsUploading(false); return; }
        let photoUrl1 = null; let photoUrl2 = null;
        try {
            if (photo1File) { photoUrl1 = await uploadReportPhoto(photo1File, formData.child_id, 1); if (!photoUrl1) throw new Error("Photo 1 upload failed."); }
            if (photo2File) { photoUrl2 = await uploadReportPhoto(photo2File, formData.child_id, 2); if (!photoUrl2) throw new Error("Photo 2 upload failed."); }
        } catch (uploadError) { showAlert(`Photo upload failed: ${uploadError.message}`, 'error'); setIsUploading(false); return; }
        const reportData = { ...formData, staff_id: currentStaffMember.id, photo_url_1: photoUrl1, photo_url_2: photoUrl2, };
        await onAddDailyReport(reportData); setIsUploading(false);
    };
    return ( <div className="page-card form-page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Reports</button> <h2 className="page-card-title form-page-title">Create Daily Report</h2> <form onSubmit={handleSubmit} className="form-layout"> <SelectField label="Child" id="child_id" name="child_id" value={formData.child_id} onChange={handleChange} required icon={Smile}> <option value="">Select Child</option> {Array.isArray(children) && children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)} </SelectField> <InputField label="Report Date" id="report_date" name="report_date" type="date" value={formData.report_date} onChange={handleChange} required /> <SelectField label="Mood" id="mood" name="mood" value={formData.mood} onChange={handleChange}> <option value="Happy">Happy</option><option value="Playful">Playful</option><option value="Tired">Tired</option><option value="Quiet">Quiet</option><option value="Upset">Upset</option> </SelectField> <h3 className="form-section-title">Meals</h3> <InputField label="Breakfast Notes" name="breakfast" value={formData.meals.breakfast} onChange={(e) => handleMealChange(e, 'breakfast')} placeholder="e.g., Ate all cereal"/> <InputField label="Lunch Notes" name="lunch" value={formData.meals.lunch} onChange={(e) => handleMealChange(e, 'lunch')} placeholder="e.g., Enjoyed pasta, some veggies"/> <h3 className="form-section-title">Naps</h3> {formData.naps.map((nap, index) => ( <div key={index} className="form-row"> <InputField label={`Nap ${index+1} Start`} type="time" value={nap.start} onChange={(e) => handleNapChange(e, index, 'start')} /> <InputField label={`Nap ${index+1} End`} type="time" value={nap.end} onChange={(e) => handleNapChange(e, index, 'end')} /> </div> ))} <button type="button" onClick={addNapField} className="btn btn-secondary btn-small">Add Another Nap</button> <TextAreaField label="Activities" id="activities" name="activities" value={formData.activities} onChange={handleChange} /> <TextAreaField label="Toileting/Diapers" id="toileting_diapers" name="toileting_diapers" value={formData.toileting_diapers} onChange={handleChange} /> <TextAreaField label="Supplies Needed" id="supplies_needed" name="supplies_needed" value={formData.supplies_needed} onChange={handleChange} /> <TextAreaField label="Notes for Parents" id="notes_for_parents" name="notes_for_parents" value={formData.notes_for_parents} onChange={handleChange} /> <h3 className="form-section-title">Photos (Optional)</h3> <InputField label="Photo 1" id="photo1File" name="photo1File" type="file" onChange={(e) => handleFileChange(e, 1)} icon={UploadCloud} accept="image/*" /> {photo1File && <p className="file-name-display">Selected: {photo1File.name}</p>} <InputField label="Photo 2" id="photo2File" name="photo2File" type="file" onChange={(e) => handleFileChange(e, 2)} icon={UploadCloud} accept="image/*" /> {photo2File && <p className="file-name-display">Selected: {photo2File.name}</p>} <FormActions onCancel={onCancel} submitText="Add Report" submitIcon={PlusCircle} loading={isUploading} /> </form> </div> );
};
const ViewDailyReportModal = ({ report, child, staff, onClose }) => {
    if (!report) return null; const childName = child?.name || 'Unknown Child'; 
    const reportingStaffMember = Array.isArray(staff) ? (staff.find(s => s.id === report.staff_id)) : null;
    const staffName = reportingStaffMember?.name || 'Unknown Staff';
    const formatTime = (timeStr) => { if (!timeStr) return 'N/A'; const [hours, minutes] = timeStr.split(':'); const date = new Date(); date.setHours(parseInt(hours), parseInt(minutes)); return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
    return ( <Modal onClose={onClose} title={`Daily Report for ${childName} - ${formatDateForInput(report.report_date)}`} size="large"> <div className="report-details-grid"> <div className="report-detail-item"><strong>Mood:</strong> <span className={`mood-badge mood-${report.mood?.toLowerCase()}`}>{report.mood || 'N/A'}</span></div> <div className="report-section"><h4>Meals</h4> <p><strong>Breakfast:</strong> {report.meals?.breakfast || 'N/A'}</p> <p><strong>Lunch:</strong> {report.meals?.lunch || 'N/A'}</p> </div> <div className="report-section"><h4>Naps</h4> {(report.naps && report.naps.length > 0 && report.naps[0].start) ? report.naps?.map((nap, i) => <p key={i}><strong>Nap {i+1}:</strong> {formatTime(nap.start)} - {formatTime(nap.end)}</p>) : <p>No naps recorded.</p>}</div> <div className="report-section"><h4>Activities & Care</h4> <p><strong>Activities:</strong> {report.activities || 'N/A'}</p> <p><strong>Toileting/Diapers:</strong> {report.toileting_diapers || 'N/A'}</p> </div> <div className="report-section"><h4>Notes & Supplies</h4> <p><strong>Supplies Needed:</strong> {report.supplies_needed || 'N/A'}</p> <p><strong>Notes for Parents:</strong> {report.notes_for_parents || 'N/A'}</p> </div> {(report.photo_url_1 || report.photo_url_2) && <div className="report-section"><h4>Photos</h4> {report.photo_url_1 && <div className="report-photo-item"><p><strong>Photo 1:</strong></p><img src={report.photo_url_1} alt={`Activity for ${childName} on ${formatDateForInput(report.report_date)}`} className="report-photo-preview"/></div>} {report.photo_url_2 && <div className="report-photo-item"><p><strong>Photo 2:</strong></p><img src={report.photo_url_2} alt={`Additional activity for ${childName} on ${formatDateForInput(report.report_date)}`} className="report-photo-preview"/></div>} </div>} <p className="report-meta"><em>Reported by: {staffName}</em></p> </div> </Modal> );
};

// --- INCIDENT REPORTS COMPONENTS ---
const AdminIncidentReportsPage = ({ incidentReports, loading, children, staff, onNavigateToLogIncident, onViewIncidentDetails }) => {
    if (loading && (!Array.isArray(incidentReports) || incidentReports.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading incidents...</div>;
    const childNameMap = Array.isArray(children) ? children.reduce((acc, child) => { acc[child.id] = child.name; return acc; }, {}) : {}; const staffNameMap = Array.isArray(staff) ? staff.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {}) : {};
    return ( <div className="page-card"> <div className="page-card-header"> <h2 className="page-card-title">Incident Reports</h2> <button onClick={onNavigateToLogIncident} className="btn btn-primary btn-small"><AlertTriangle size={18} /> Log New Incident</button> </div> {(!loading && (!Array.isArray(incidentReports) || incidentReports.length === 0)) ? (<InfoMessage message="No incident reports found." icon={ShieldAlert}/>) : ( <div className="table-container"> <table className="data-table"> <thead><tr><th className="th-cell">Date/Time</th><th className="th-cell">Child</th><th className="th-cell th-sm-hidden">Location</th><th className="th-cell th-md-hidden">Reported By</th><th className="th-cell">Status</th><th className="th-cell th-actions">Actions</th></tr></thead> <tbody>{Array.isArray(incidentReports) && incidentReports.map(incident => (<tr key={incident.id} className="table-row"> <td className="td-cell">{new Date(incident.incident_datetime).toLocaleString()}</td> <td className="td-cell td-name">{childNameMap[incident.child_id] || 'N/A'}</td> <td className="td-cell td-sm-hidden">{incident.location}</td> <td className="td-cell td-md-hidden">{staffNameMap[incident.reported_by_staff_id] || 'Unknown'}</td> <td className="td-cell"><span className={`status-badge status-badge-${incident.status?.toLowerCase().replace(' ', '-')}`}>{incident.status}</span></td> <td className="td-cell td-actions"><button onClick={() => onViewIncidentDetails(incident)} className="btn-icon table-action-button" title="View Details"><Eye size={16}/></button></td> </tr>))}</tbody></table></div>)}</div>);
};
const LogIncidentPage = ({ children, staff, onLogIncident, onCancel, currentUser, showAlert }) => {
    const [formData, setFormData] = useState({ incident_datetime: formatDateTimeForInput(new Date()), child_id: '', location: '', description: '', actions_taken: '', witnesses: '', parent_notified: false, parent_notification_datetime: null, status: 'Open' });
    const handleChange = (e) => { const { name, value, type, checked } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.incident_datetime || !formData.description) { showAlert("Incident Date/Time and Description are required.", "error"); return; }
        if (!currentUser?.id) { showAlert("Current user not found.", "error"); return; }
        if (!Array.isArray(staff) || staff.length === 0) { showAlert("Staff data unavailable.", "error"); return; }
        const currentStaffMember = staff.find(s => s.user_id === currentUser.id);
        if (!currentStaffMember) { showAlert("Matching staff profile not found.", "error"); return; }
        const incidentData = { ...formData, reported_by_staff_id: currentStaffMember.id };
        onLogIncident(incidentData);
    };
    return ( <div className="page-card form-page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Incidents</button> <h2 className="page-card-title form-page-title">Log New Incident</h2> <form onSubmit={handleSubmit} className="form-layout"> <InputField label="Incident Date & Time" id="incident_datetime" name="incident_datetime" type="datetime-local" value={formData.incident_datetime} onChange={handleChange} required /> <SelectField label="Child Involved (Primary)" id="child_id" name="child_id" value={formData.child_id} onChange={handleChange} icon={Smile}> <option value="">Select Child (if applicable)</option> {Array.isArray(children) && children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)} </SelectField> <InputField label="Location of Incident" id="location" name="location" value={formData.location} onChange={handleChange} /> <TextAreaField label="Detailed Description" id="description" name="description" value={formData.description} onChange={handleChange} required /> <TextAreaField label="Actions Taken" id="actions_taken" name="actions_taken" value={formData.actions_taken} onChange={handleChange} /> <InputField label="Witnesses" id="witnesses" name="witnesses" value={formData.witnesses} onChange={handleChange} /> <CheckboxField label="Parent Notified?" id="parent_notified" name="parent_notified" checked={formData.parent_notified} onChange={handleChange} /> {formData.parent_notified && <InputField label="Parent Notification Date/Time" id="parent_notification_datetime" name="parent_notification_datetime" type="datetime-local" value={formatDateTimeForInput(formData.parent_notification_datetime)} onChange={handleChange} />} <SelectField label="Status" id="status" name="status" value={formData.status} onChange={handleChange}><option value="Open">Open</option><option value="Under Review">Under Review</option><option value="Resolved">Resolved</option></SelectField> <FormActions onCancel={onCancel} submitText="Log Incident" submitIcon={ShieldAlert} /> </form> </div> );
};
const ViewIncidentDetailsModal = ({ incident, child, reportedByStaff, onClose }) => {
  if (!incident) return null; const childName = child?.name || 'N/A'; const staffName = reportedByStaff?.name || 'Unknown Staff';
  return ( <Modal onClose={onClose} title={`Incident Details: ${childName}`} size="large"> <div className="report-details-grid"> <div className="report-detail-item"><strong>Date & Time:</strong> {new Date(incident.incident_datetime).toLocaleString()}</div> <div className="report-detail-item"><strong>Child Involved:</strong> {childName}</div> <div className="report-detail-item"><strong>Location:</strong> {incident.location || 'N/A'}</div> <div className="report-detail-item"><strong>Reported By:</strong> {staffName}</div> <div className="report-detail-item"><strong>Status:</strong> <span className={`status-badge status-badge-${incident.status?.toLowerCase().replace(' ', '-')}`}>{incident.status || 'N/A'}</span></div> <div className="report-detail-item"><strong>Parent Notified:</strong> {incident.parent_notified ? 'Yes' : 'No'}</div> {incident.parent_notified && (<div className="report-detail-item"><strong>Parent Notification Time:</strong> {incident.parent_notification_datetime ? new Date(incident.parent_notification_datetime).toLocaleString() : 'N/A'}</div>)} <div className="report-section" style={{ gridColumn: '1 / -1' }}><h4>Description</h4><p>{incident.description || 'No description.'}</p></div> <div className="report-section" style={{ gridColumn: '1 / -1' }}><h4>Actions Taken</h4><p>{incident.actions_taken || 'No actions recorded.'}</p></div> {incident.witnesses && (<div className="report-section" style={{ gridColumn: '1 / -1' }}><h4>Witnesses</h4><p>{incident.witnesses}</p></div>)} {incident.admin_follow_up_notes && (<div className="report-section" style={{ gridColumn: '1 / -1' }}><h4>Admin Follow-up Notes</h4><p>{incident.admin_follow_up_notes}</p></div>)} <p className="report-meta" style={{ gridColumn: '1 / -1' }}><em>Incident ID: {incident.id}</em><br/><em>Logged at: {new Date(incident.created_at).toLocaleString()}</em></p> </div> </Modal> );
};

// --- MEDICATION COMPONENTS ---
const ChildMedicationsPage = ({ child, medications, onOpenAddMedicationModal, onOpenEditMedicationModal, onOpenLogAdministrationModal, onDeleteMedication, onCancel }) => {
    if (!child) return <InfoMessage message="No child selected." type="warning"/>;
    const childMedications = Array.isArray(medications) ? medications.filter(med => med.child_id === child.id) : [];
    return ( <div className="page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Children</button> <div className="page-card-header"> <h2 className="page-card-title">Medications for {child.name}</h2> <button onClick={() => onOpenAddMedicationModal(child.id)} className="btn btn-primary btn-small"><PlusCircle size={18}/> Add Medication</button> </div> {childMedications.length === 0 ? (<InfoMessage message="No medications listed for this child." icon={Pill}/>) : ( <div className="table-container"> <table className="data-table"> <thead><tr><th>Name</th><th>Dosage</th><th>Frequency</th><th>Status</th><th>Actions</th></tr></thead> <tbody>{childMedications.map(med => ( <tr key={med.id}> <td className="td-cell td-name">{med.medication_name}</td> <td className="td-cell">{med.dosage}</td> <td className="td-cell">{med.frequency_instructions}</td> <td className="td-cell">{med.is_authorized_by_parent ? <span className="status-badge status-badge-green">Authorized</span> : <span className="status-badge status-badge-orange">Needs Auth</span>}</td> <td className="td-cell td-actions"> <button onClick={() => onOpenLogAdministrationModal(med)} className="btn-icon table-action-button" title="Log Administered"><ListChecks size={16}/></button> <button onClick={() => onOpenEditMedicationModal(med)} className="btn-icon table-action-button edit" title="Edit"><Edit3 size={16}/></button> <button onClick={() => onDeleteMedication(med.id)} className="btn-icon table-action-button delete" title="Delete"><Trash2 size={16}/></button> </td> </tr> ))}</tbody> </table></div> )} </div> );
};
const AddMedicationModal = ({ childId, onClose, onAddMedication, showAlert }) => {
    const [formData, setFormData] = useState({ child_id: childId, medication_name: '', dosage: '', route: '', frequency_instructions: '', start_date: '', end_date: '', notes_instructions: '', requires_parent_authorization: true, is_authorized_by_parent: false, parent_authorization_datetime: null, authorizing_parent_name: '' });
    const handleChange = (e) => { const { name, value, type, checked } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
    const handleSubmit = (e) => { e.preventDefault(); if (!formData.medication_name || !formData.child_id) { showAlert("Medication Name and Child ID are required.", "error"); return; } const dataToSubmit = { ...formData, requires_parent_authorization: formData.requires_parent_authorization === true, is_authorized_by_parent: formData.is_authorized_by_parent === true, }; onAddMedication(dataToSubmit); };
    return ( <Modal onClose={onClose} title="Add New Medication" size="medium"> <form onSubmit={handleSubmit} className="form-layout modal-form"> <InputField label="Medication Name" name="medication_name" value={formData.medication_name} onChange={handleChange} required /> <InputField label="Dosage (e.g., 5ml, 1 tablet)" name="dosage" value={formData.dosage} onChange={handleChange} /> <InputField label="Route (e.g., Oral, Topical)" name="route" value={formData.route} onChange={handleChange} /> <TextAreaField label="Frequency & Instructions" name="frequency_instructions" value={formData.frequency_instructions} onChange={handleChange} /> <div className="form-row"> <InputField label="Start Date" name="start_date" type="date" value={formData.start_date} onChange={handleChange} /> <InputField label="End Date" name="end_date" type="date" value={formData.end_date} onChange={handleChange} /> </div> <TextAreaField label="Additional Notes/Instructions" name="notes_instructions" value={formData.notes_instructions} onChange={handleChange} /> <CheckboxField label="Requires Parent Authorization" name="requires_parent_authorization" checked={formData.requires_parent_authorization} onChange={handleChange} /> <CheckboxField label="Is Authorized by Parent (Confirmed)" name="is_authorized_by_parent" checked={formData.is_authorized_by_parent} onChange={handleChange} /> {formData.is_authorized_by_parent && (<> <InputField label="Parent Authorization Date/Time" name="parent_authorization_datetime" type="datetime-local" value={formatDateTimeForInput(formData.parent_authorization_datetime)} onChange={handleChange} /> <InputField label="Authorizing Parent Name (If known)" name="authorizing_parent_name" value={formData.authorizing_parent_name} onChange={handleChange} /> </>)} <FormActions onCancel={onClose} submitText="Add Medication" submitIcon={PlusCircle} /> </form> </Modal> );
};
const EditMedicationModal = ({ medication, onClose, onUpdateMedication, showAlert }) => {
    const [formData, setFormData] = useState({ id: medication.id, child_id: medication.child_id, medication_name: medication.medication_name || '', dosage: medication.dosage || '', route: medication.route || '', frequency_instructions: medication.frequency_instructions || '', start_date: formatDateForInput(medication.start_date), end_date: formatDateForInput(medication.end_date), notes_instructions: medication.notes_instructions || '', requires_parent_authorization: medication.requires_parent_authorization !== false, is_authorized_by_parent: medication.is_authorized_by_parent || false, parent_authorization_datetime: formatDateTimeForInput(medication.parent_authorization_datetime), authorizing_parent_name: medication.authorizing_parent_name || '' });
    const handleChange = (e) => { const { name, value, type, checked } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
    const handleSubmit = (e) => { e.preventDefault(); if (!formData.medication_name) { showAlert("Medication Name is required.", "error"); return; } const dataToSubmit = { ...formData, requires_parent_authorization: formData.requires_parent_authorization === true, is_authorized_by_parent: formData.is_authorized_by_parent === true, }; onUpdateMedication(dataToSubmit); };
    return ( <Modal onClose={onClose} title={`Edit ${formData.medication_name}`} size="medium"> <form onSubmit={handleSubmit} className="form-layout modal-form"> <InputField label="Medication Name" name="medication_name" value={formData.medication_name} onChange={handleChange} required /> <InputField label="Dosage" name="dosage" value={formData.dosage} onChange={handleChange} /> <InputField label="Route" name="route" value={formData.route} onChange={handleChange} /> <TextAreaField label="Frequency & Instructions" name="frequency_instructions" value={formData.frequency_instructions} onChange={handleChange} /> <div className="form-row"> <InputField label="Start Date" name="start_date" type="date" value={formData.start_date} onChange={handleChange} /> <InputField label="End Date" name="end_date" type="date" value={formData.end_date} onChange={handleChange} /> </div> <TextAreaField label="Additional Notes/Instructions" name="notes_instructions" value={formData.notes_instructions} onChange={handleChange} /> <CheckboxField label="Requires Parent Authorization" name="requires_parent_authorization" checked={formData.requires_parent_authorization} onChange={handleChange} /> <CheckboxField label="Is Authorized by Parent" name="is_authorized_by_parent" checked={formData.is_authorized_by_parent} onChange={handleChange} /> {formData.is_authorized_by_parent && (<> <InputField label="Parent Authorization Date/Time" name="parent_authorization_datetime" type="datetime-local" value={formData.parent_authorization_datetime} onChange={handleChange} /> <InputField label="Authorizing Parent Name" name="authorizing_parent_name" value={formData.authorizing_parent_name} onChange={handleChange} /> </>)} <FormActions onCancel={onClose} submitText="Save Changes" submitIcon={CheckCircle} /> </form> </Modal> );
};
const LogMedicationAdministrationModal = ({ medicationToLog, childId, onClose, onLogAdministration, currentUser, showAlert }) => {
    const { staff } = React.useContext(AppStateContext);
    const [formData, setFormData] = useState({ medication_id: medicationToLog?.id, child_id: childId, administered_at: formatDateTimeForInput(new Date()), actual_dosage_given: medicationToLog?.dosage || '', notes: '' });
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.actual_dosage_given || !formData.administered_at) { showAlert("Actual Dosage and Administration Time are required.", "error"); return; }
        if (!currentUser?.id) { showAlert("Current user not found.", "error"); return; }
        if (!Array.isArray(staff) || staff.length === 0) { showAlert("Staff data unavailable.", "error"); return; }
        const currentStaffMember = staff.find(s => s.user_id === currentUser.id);
        if (!currentStaffMember) { showAlert("Matching staff profile not found.", "error"); return; }
        const logData = { ...formData, administered_by_staff_id: currentStaffMember.id };
        onLogAdministration(logData);
    };
    if (!medicationToLog) return null;
    return ( <Modal onClose={onClose} title={`Log Admin for ${medicationToLog.medication_name}`} size="medium"> <form onSubmit={handleSubmit} className="form-layout modal-form"> <p><strong>Medication:</strong> {medicationToLog.medication_name}</p> <p><strong>Standard Dosage:</strong> {medicationToLog.dosage}</p> <InputField label="Actual Dosage Given" name="actual_dosage_given" value={formData.actual_dosage_given} onChange={handleChange} required /> <InputField label="Administration Date & Time" name="administered_at" type="datetime-local" value={formData.administered_at} onChange={handleChange} required /> <TextAreaField label="Notes/Observations" name="notes" value={formData.notes} onChange={handleChange} /> <FormActions onCancel={onClose} submitText="Log Administration" submitIcon={ListChecks} /> </form> </Modal> );
};

// --- ANNOUNCEMENTS COMPONENTS ---
const AdminAnnouncementsPage = ({ announcements, loading, staff, onNavigateToCreateAnnouncement, onEditAnnouncement, onDeleteAnnouncement }) => {
    if (loading && announcements.length === 0) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading announcements...</div>;
    const staffNameMap = Array.isArray(staff) ? staff.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {}) : {};
    return ( <div className="page-card"> <div className="page-card-header"> <h2 className="page-card-title">Manage Announcements</h2> {onNavigateToCreateAnnouncement && <button onClick={onNavigateToCreateAnnouncement} className="btn btn-primary btn-small"><PlusCircle size={18}/> Create Announcement</button>} </div> {(!loading && announcements.length === 0) ? (<InfoMessage message="No announcements found." icon={Megaphone}/>) : ( <div className="announcements-list"> {announcements.map(ann => ( <div key={ann.id} className="announcement-item page-card-item"> <div className="announcement-item-header"> <h3 className="announcement-title">{ann.title}</h3> <span className={`status-badge ${ann.is_published ? 'status-badge-green' : 'status-badge-orange'}`}> {ann.is_published ? 'Published' : 'Draft'} </span> </div> <p className="announcement-meta"> By: {staffNameMap[ann.author_staff_id] || 'Unknown'} | Published: {formatDateForInput(ann.publish_date)} {ann.expiry_date && ` | Expires: ${formatDateForInput(ann.expiry_date)}`} {ann.category && ` | Category: ${ann.category}`} </p> <p className="announcement-content">{ann.content.substring(0, 150)}{ann.content.length > 150 ? '...' : ''}</p> {(onEditAnnouncement || onDeleteAnnouncement) && <div className="announcement-actions td-actions"> {onEditAnnouncement && <button onClick={() => onEditAnnouncement(ann)} className="btn-icon table-action-button edit" title="Edit"><Edit3 size={16}/></button>} {onDeleteAnnouncement && <button onClick={() => onDeleteAnnouncement(ann.id)} className="btn-icon table-action-button delete" title="Delete"><Trash2 size={16}/></button>} </div>} </div> ))} </div> )} </div> );
};
const CreateAnnouncementPage = ({ onAddAnnouncement, onUpdateAnnouncement, onCancel, currentUser, initialData = null, showAlert }) => {
    const { staff } = React.useContext(AppStateContext);
    const [formData, setFormData] = useState({ title: initialData?.title || '', content: initialData?.content || '', publish_date: formatDateForInput(initialData?.publish_date || new Date()), expiry_date: formatDateForInput(initialData?.expiry_date), category: initialData?.category || '', is_published: initialData ? initialData.is_published : true, });
    const isEditing = !!initialData;
    const handleChange = (e) => { const { name, value, type, checked } = e.target; setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value })); };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.title || !formData.content) { showAlert("Title and Content are required.", "error"); return; }
        if (!currentUser?.id) { showAlert("Current user not found.", "error"); return; }
        if (!Array.isArray(staff) || staff.length === 0) { showAlert("Staff data unavailable.", "error"); return; }
        const currentStaffMember = staff.find(s => s.user_id === currentUser.id);
        if (!currentStaffMember) { showAlert("Matching staff profile not found.", "error"); return; }
        const announcementData = { ...formData, author_staff_id: currentStaffMember.id };
        if (isEditing) { onUpdateAnnouncement({ ...announcementData, id: initialData.id }); }
        else { onAddAnnouncement(announcementData); }
    };
    return ( <div className="page-card form-page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Announcements</button> <h2 className="page-card-title form-page-title">{isEditing ? 'Edit Announcement' : 'Create New Announcement'}</h2> <form onSubmit={handleSubmit} className="form-layout"> <InputField label="Title" name="title" value={formData.title} onChange={handleChange} required /> <TextAreaField label="Content" name="content" value={formData.content} onChange={handleChange} rows={5} required /> <div className="form-row"> <InputField label="Publish Date" name="publish_date" type="date" value={formData.publish_date} onChange={handleChange} required /> <InputField label="Expiry Date (Optional)" name="expiry_date" type="date" value={formData.expiry_date} onChange={handleChange} /> </div> <InputField label="Category (Optional)" name="category" value={formData.category} onChange={handleChange} placeholder="e.g., General, Event, Urgent" /> <CheckboxField label="Is Published" name="is_published" checked={formData.is_published} onChange={handleChange} /> <FormActions onCancel={onCancel} submitText={isEditing ? "Save Changes" : "Create Announcement"} submitIcon={isEditing ? CheckCircle : PlusCircle} /> </form> </div> );
};

// --- BILLING COMPONENTS ---
const AdminBillingPage = ({ invoices, loading, children, onNavigateToCreateInvoice, onViewInvoiceDetails }) => {
    if (loading && (!Array.isArray(invoices) || invoices.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading invoices...</div>;
    const childNameMap = Array.isArray(children) ? children.reduce((acc, child) => { acc[child.id] = child.name; return acc; }, {}) : {};
    return ( <div className="page-card"> <div className="page-card-header"> <h2 className="page-card-title">Billing & Invoices</h2> {onNavigateToCreateInvoice && <button onClick={onNavigateToCreateInvoice} className="btn btn-primary btn-small"><FilePlus size={18}/> Create New Invoice</button>} </div> {(!loading && (!Array.isArray(invoices) || invoices.length === 0)) ? (<InfoMessage message="No invoices found." icon={DollarSign}/>) : ( <div className="table-container"> <table className="data-table"> <thead><tr> <th className="th-cell">Invoice #</th> <th className="th-cell">Child</th> <th className="th-cell">Issue Date</th> <th className="th-cell th-sm-hidden">Due Date</th> <th className="th-cell">Amount Due</th> <th className="th-cell">Status</th> <th className="th-cell th-actions">Actions</th> </tr></thead> <tbody>{Array.isArray(invoices) && invoices.map(inv => ( <tr key={inv.id} className="table-row"> <td className="td-cell">{inv.invoice_number}</td> <td className="td-cell td-name">{childNameMap[inv.child_id] || 'N/A'}</td> <td className="td-cell">{formatDateForInput(inv.invoice_date)}</td> <td className="td-cell th-sm-hidden">{formatDateForInput(inv.due_date)}</td> <td className="td-cell">${parseFloat(inv.amount_due).toFixed(2)}</td> <td className="td-cell"><span className={`status-badge status-badge-${inv.status?.toLowerCase()}`}>{inv.status}</span></td> <td className="td-cell td-actions"> <button onClick={() => onViewInvoiceDetails(inv)} className="btn-icon table-action-button" title="View Details"><Eye size={16}/></button> </td> </tr> ))}</tbody> </table> </div> )} </div> );
};
const CreateInvoicePage = ({ children, onAddInvoice, onCancel, showAlert }) => {
    const [formData, setFormData] = useState({ child_id: '', invoice_number: '', invoice_date: formatDateForInput(new Date()), due_date: '', amount_due: '', status: 'Unpaid', items: [{ description: 'Monthly Fee', amount: '' }], notes_to_parent: '' });
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleItemChange = (index, field, value) => { const newItems = [...formData.items]; newItems[index][field] = value; const total = newItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0); setFormData(prev => ({ ...prev, items: newItems, amount_due: total.toFixed(2) })); };
    const addItem = () => { setFormData(prev => ({ ...prev, items: [...prev.items, { description: '', amount: '' }] })); };
    const removeItem = (index) => { const newItems = formData.items.filter((_, i) => i !== index); const total = newItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0); setFormData(prev => ({ ...prev, items: newItems, amount_due: total.toFixed(2) })); };
    const handleSubmit = (e) => {
        e.preventDefault();
        if (!formData.child_id || !formData.invoice_number || !formData.amount_due || parseFloat(formData.amount_due) <= 0) { showAlert("Child, Invoice Number, and a valid Amount Due are required.", "error"); return; }
        const validItems = formData.items.filter(item => item.description && parseFloat(item.amount) > 0);
        if (validItems.length === 0) { showAlert("At least one valid line item is required.", "error"); return; }
        onAddInvoice({ ...formData, items: validItems, amount_due: parseFloat(formData.amount_due) });
    };
    return ( <div className="page-card form-page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Billing</button> <h2 className="page-card-title form-page-title">Create New Invoice</h2> <form onSubmit={handleSubmit} className="form-layout"> <SelectField label="Child" id="child_id" name="child_id" value={formData.child_id} onChange={handleChange} required icon={Smile}> <option value="">Select Child</option> {Array.isArray(children) && children.map(child => <option key={child.id} value={child.id}>{child.name}</option>)} </SelectField> <InputField label="Invoice Number" name="invoice_number" value={formData.invoice_number} onChange={handleChange} required /> <div className="form-row"> <InputField label="Invoice Date" name="invoice_date" type="date" value={formData.invoice_date} onChange={handleChange} required /> <InputField label="Due Date" name="due_date" type="date" value={formData.due_date} onChange={handleChange} /> </div> <h3 className="form-section-title">Invoice Items</h3> {formData.items.map((item, index) => ( <div key={index} className="invoice-item-row form-row"> <InputField label={`Item ${index + 1} Description`} placeholder="e.g., Monthly Fee, Late Pickup" value={item.description} onChange={(e) => handleItemChange(index, 'description', e.target.value)} /> <InputField label="Amount" type="number" step="0.01" placeholder="0.00" value={item.amount} onChange={(e) => handleItemChange(index, 'amount', e.target.value)} /> {formData.items.length > 1 && <button type="button" onClick={() => removeItem(index)} className="btn btn-danger btn-small btn-remove-item"><Trash2 size={14}/></button>} </div> ))} <button type="button" onClick={addItem} className="btn btn-secondary btn-small">Add Line Item</button> <InputField label="Total Amount Due" name="amount_due" type="number" value={formData.amount_due} onChange={handleChange} required disabled icon={DollarSign} /> <SelectField label="Status" name="status" value={formData.status} onChange={handleChange}> <option value="Unpaid">Unpaid</option> <option value="Paid">Paid</option> <option value="Draft">Draft</option> <option value="Overdue">Overdue</option> </SelectField> <TextAreaField label="Notes to Parent (Optional)" name="notes_to_parent" value={formData.notes_to_parent} onChange={handleChange} /> <FormActions onCancel={onCancel} submitText="Create Invoice" submitIcon={FilePlus} /> </form> </div> );
};
const ViewInvoiceDetailsModal = ({ invoice, child, parentDetails, onClose }) => {
    if (!invoice) return null;
    const billToName = parentDetails ? `${parentDetails.first_name || ''} ${parentDetails.last_name || ''}`.trim() : (child?.parent_name || "N/A (Parent Name)");
    const billToEmail = parentDetails?.email || child?.parent_email || "";
    const billToAddress1 = parentDetails?.address_line1 || "Parent Address Line 1 (Placeholder)";
    const billToCityStatePostal = [parentDetails?.city, parentDetails?.province_state, parentDetails?.postal_code].filter(Boolean).join(', ') || "City, Province, Postal (Placeholder)";
    const childNameForInvoice = child?.name || "N/A";
    const items = invoice.items || [];
    const handleDownloadPDF = () => { if (invoice && child) { generateInvoicePDF(invoice, child, parentDetails); } else { alert("Error: Invoice, child, or parent data is missing for PDF generation."); } };
    return ( <Modal onClose={onClose} title={`Invoice #${invoice.invoice_number || 'Details'}`} size="large"> <div className="invoice-details-container"> <div className="invoice-header-section"> <div> <h4 className="invoice-section-title">Invoice To:</h4> <p><strong>{billToName}</strong></p> {billToEmail && <p>{billToEmail}</p>} <p>{billToAddress1}</p> <p>{billToCityStatePostal}</p> <p style={{marginTop: '0.5rem', fontSize: '0.85rem'}}>For services rendered to: {childNameForInvoice}</p> </div> <div style={{textAlign: 'right'}}> <h4 className="invoice-section-title">Invoice Details:</h4> <p><strong>Invoice #:</strong> {invoice.invoice_number}</p> <p><strong>Issue Date:</strong> {formatDateForInput(invoice.invoice_date)}</p> <p><strong>Due Date:</strong> {invoice.due_date ? formatDateForInput(invoice.due_date) : 'N/A'}</p> <p><strong>Status:</strong> <span className={`status-badge status-badge-${invoice.status?.toLowerCase()}`}>{invoice.status}</span></p> </div> </div> <h4 className="invoice-section-title" style={{marginTop: '1.5rem'}}>Line Items:</h4> <div className="table-container invoice-items-table-container"> <table className="data-table"> <thead> <tr> <th className="th-cell">Description</th> <th className="th-cell" style={{textAlign: 'right'}}>Amount</th> </tr> </thead> <tbody> {items.length > 0 ? items.map((item, index) => ( <tr key={index} className="table-row"> <td className="td-cell">{item.description}</td> <td className="td-cell" style={{textAlign: 'right'}}>${parseFloat(item.amount).toFixed(2)}</td> </tr> )) : ( <tr className="table-row"><td className="td-cell" colSpan="2">No items on this invoice.</td></tr> )} </tbody> <tfoot> <tr className="table-row-total"> <td className="td-cell" style={{fontWeight: 'bold', textAlign: 'right'}}>Total Amount Due:</td> <td className="td-cell" style={{fontWeight: 'bold', textAlign: 'right'}}>${parseFloat(invoice.amount_due).toFixed(2)}</td> </tr> </tfoot> </table> </div> {invoice.notes_to_parent && ( <div className="invoice-notes-section"> <h4 className="invoice-section-title">Notes:</h4> <p>{invoice.notes_to_parent}</p> </div> )} <div className="form-actions" style={{borderTop: 'none', marginTop: '1.5rem', justifyContent: 'center', gap: '1rem'}}> <button type="button" onClick={handleDownloadPDF} className="btn btn-secondary"> <Download size={16} style={{marginRight: '0.5rem'}}/> Download PDF </button> <button type="button" onClick={onClose} className="btn btn-primary"> Close </button> </div> </div> </Modal> );
};
const generateInvoicePDF = (invoice, child, parentDetails) => {
    const doc = new jsPDF(); const pageMargin = 15; const lineHeight = 7; let currentY = pageMargin;
    const daycareName = "Your Daycare Name"; const daycareAddress = "123 Daycare St, City, Province A1B 2C3"; const daycareContact = "Phone: (555) 555-5555 | Email: contact@yourdaycare.com";
    const addText = (text, x, y, options = {}) => { doc.setFontSize(options.fontSize || 10); doc.setFont(undefined, options.fontStyle || 'normal'); doc.text(text, x, y); if (options.moveY !== false) currentY += (options.customLineHeight || lineHeight); };
    doc.setFontSize(18); doc.setFont(undefined, 'bold'); doc.text("INVOICE", pageMargin, currentY); currentY += lineHeight * 1.5;
    doc.setFontSize(10); doc.setFont(undefined, 'normal'); addText(daycareName, pageMargin, currentY); addText(daycareAddress, pageMargin, currentY); addText(daycareContact, pageMargin, currentY); currentY += lineHeight;
    const rightColumnX = doc.internal.pageSize.getWidth() / 2 + 10; const detailsXOffset = 30; const initialDetailsY = currentY;
    addText("BILL TO:", pageMargin, currentY, { fontStyle: 'bold'});
    if (parentDetails) { addText(`${parentDetails.first_name || ''} ${parentDetails.last_name || ''}`.trim(), pageMargin, currentY); if (parentDetails.address_line1) addText(parentDetails.address_line1, pageMargin, currentY); let cityProvincePostal = ''; if (parentDetails.city) cityProvincePostal += parentDetails.city; if (parentDetails.province_state) cityProvincePostal += (cityProvincePostal ? ', ' : '') + parentDetails.province_state; if (parentDetails.postal_code) cityProvincePostal += (cityProvincePostal ? ' ' : '') + parentDetails.postal_code; if (cityProvincePostal) addText(cityProvincePostal, pageMargin, currentY); if (parentDetails.email) addText(parentDetails.email, pageMargin, currentY); }
    else { addText(child?.parent_name || "N/A (Parent Name)", pageMargin, currentY); if (child?.parent_email) addText(child.parent_email, pageMargin, currentY); }
    addText(`For Child: ${child?.name || 'N/A'}`, pageMargin, currentY, {fontSize: 9, fontStyle: 'italic'});
    let billToLines = 2; if (parentDetails) { billToLines += (parentDetails.first_name || parentDetails.last_name ? 1 : 0); billToLines += (parentDetails.address_line1 ? 1 : 0); billToLines += ((parentDetails.city || parentDetails.province_state || parentDetails.postal_code) ? 1 : 0); billToLines += (parentDetails.email ? 1 : 0); } else { billToLines += (child?.parent_name ? 1 : 0); billToLines += (child?.parent_email ? 1 : 0); }
    currentY = initialDetailsY;
    addText("Invoice #:", rightColumnX, currentY, {moveY: false, fontStyle: 'bold'}); doc.text(invoice.invoice_number || "N/A", rightColumnX + detailsXOffset, currentY); currentY += lineHeight;
    addText("Issue Date:", rightColumnX, currentY, {moveY: false, fontStyle: 'bold'}); doc.text(formatDateForInput(invoice.invoice_date) || "N/A", rightColumnX + detailsXOffset, currentY); currentY += lineHeight;
    addText("Due Date:", rightColumnX, currentY, {moveY: false, fontStyle: 'bold'}); doc.text(invoice.due_date ? formatDateForInput(invoice.due_date) : "N/A", rightColumnX + detailsXOffset, currentY); currentY += lineHeight;
    addText("Status:", rightColumnX, currentY, {moveY: false, fontStyle: 'bold'}); doc.text(invoice.status || "N/A", rightColumnX + detailsXOffset, currentY); currentY += lineHeight;
    currentY = Math.max(currentY, initialDetailsY + billToLines * lineHeight); currentY += lineHeight;
    const tableColumnStyles = { 0: { cellWidth: 'auto' }, 1: { cellWidth: 30, halign: 'right' }, };
    const tableHeader = [['Description', 'Amount ($)']]; const tableBody = (invoice.items || []).map(item => [ item.description, parseFloat(item.amount).toFixed(2) ]);
    autoTable(doc, { startY: currentY, head: tableHeader, body: tableBody, theme: 'striped', styles: { fontSize: 10, cellPadding: 2 }, headStyles: { fillColor: [60, 130, 246], textColor: 255, fontStyle: 'bold' }, columnStyles: tableColumnStyles, margin: { left: pageMargin, right: pageMargin } });
    currentY = doc.lastAutoTable.finalY + lineHeight;
    const totalAmountDue = parseFloat(invoice.amount_due).toFixed(2); doc.setFontSize(11); doc.setFont(undefined, 'bold'); doc.text(`Total Amount Due: $${totalAmountDue}`, doc.internal.pageSize.getWidth() - pageMargin, currentY, { align: 'right' }); currentY += lineHeight * 1.5;
    if (invoice.notes_to_parent) { addText("Notes:", pageMargin, currentY, { fontStyle: 'bold' }); doc.setFontSize(10); doc.setFont(undefined, 'normal'); const notesLines = doc.splitTextToSize(invoice.notes_to_parent, doc.internal.pageSize.getWidth() - pageMargin * 2); doc.text(notesLines, pageMargin, currentY); currentY += notesLines.length * (lineHeight * 0.7); } currentY += lineHeight;
    let footerY = doc.internal.pageSize.getHeight() - 10; if (currentY > footerY - lineHeight) { doc.addPage(); currentY = pageMargin; footerY = doc.internal.pageSize.getHeight() - 10; }
    addText("Thank you for your business!", pageMargin, footerY - lineHeight, {fontSize: 9, fontStyle: 'italic', moveY: false}); addText(`Invoice generated on: ${new Date().toLocaleDateString()}`, pageMargin, footerY, {fontSize: 8, moveY: false});
    doc.save(`Invoice-${invoice.invoice_number || child?.name.replace(/\s+/g, '_') || 'details'}.pdf`);
};

// --- WAITLIST COMPONENTS ---
const AdminWaitlistPage = ({ waitlistEntries, loading, onNavigateToAddWaitlistEntry, onEditWaitlistEntry, onDeleteWaitlistEntry }) => {
    if (loading && (!Array.isArray(waitlistEntries) || waitlistEntries.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading waitlist...</div>;
    return ( <div className="page-card"> <div className="page-card-header"> <h2 className="page-card-title">Waitlist Management</h2> <button onClick={onNavigateToAddWaitlistEntry} className="btn btn-primary btn-small"><UserPlus size={18}/> Add to Waitlist</button> </div> {(!loading && (!Array.isArray(waitlistEntries) || waitlistEntries.length === 0)) ? (<InfoMessage message="The waitlist is currently empty." icon={ListOrdered}/>) : ( <div className="table-container"> <table className="data-table"> <thead><tr> <th className="th-cell">Child Name</th> <th className="th-cell th-sm-hidden">DOB</th> <th className="th-cell">Parent Name</th> <th className="th-cell th-md-hidden">Parent Contact</th> <th className="th-cell th-lg-hidden">Desired Start</th> <th className="th-cell">Status</th> <th className="th-cell th-actions">Actions</th> </tr></thead> <tbody>{Array.isArray(waitlistEntries) && waitlistEntries.map(entry => ( <tr key={entry.id} className="table-row"> <td className="td-cell td-name">{entry.child_name}</td> <td className="td-cell th-sm-hidden">{formatDateForInput(entry.child_dob)}</td> <td className="td-cell">{entry.parent_name}</td> <td className="td-cell th-md-hidden">{entry.parent_email || entry.parent_phone}</td> <td className="td-cell th-lg-hidden">{formatDateForInput(entry.requested_start_date)}</td> <td className="td-cell"><span className={`status-badge status-badge-${entry.status?.toLowerCase()}`}>{entry.status}</span></td> <td className="td-cell td-actions"> <button onClick={() => onEditWaitlistEntry(entry)} className="btn-icon table-action-button edit" title="Edit/Update Status"><Edit3 size={16}/></button> <button onClick={() => onDeleteWaitlistEntry(entry.id)} className="btn-icon table-action-button delete" title="Remove"><UserXIcon size={16}/></button> </td> </tr> ))}</tbody> </table> </div> )} </div> );
};
const AddToWaitlistPage = ({ onAddOrUpdateWaitlistEntry, onCancel, showAlert, initialData = null }) => {
    const [formData, setFormData] = useState({ child_name: initialData?.child_name || '', child_dob: formatDateForInput(initialData?.child_dob), parent_name: initialData?.parent_name || '', parent_email: initialData?.parent_email || '', parent_phone: initialData?.parent_phone || '', requested_start_date: formatDateForInput(initialData?.requested_start_date), notes: initialData?.notes || '', status: initialData?.status || 'Pending', });
    const isEditing = !!initialData;
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = (e) => { e.preventDefault(); if (!formData.child_name || !formData.parent_name) { showAlert("Child's Name and Parent's Name are required.", "error"); return; } onAddOrUpdateWaitlistEntry({ ...formData, id: initialData?.id }, isEditing); };
    return ( <div className="page-card form-page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18} /> Back to Waitlist</button> <h2 className="page-card-title form-page-title">{isEditing ? 'Edit Waitlist Entry' : 'Add Child to Waitlist'}</h2> <form onSubmit={handleSubmit} className="form-layout"> <InputField label="Child's Full Name" name="child_name" value={formData.child_name} onChange={handleChange} required icon={Smile}/> <InputField label="Child's Date of Birth" name="child_dob" type="date" value={formData.child_dob} onChange={handleChange} /> <InputField label="Parent's Full Name" name="parent_name" value={formData.parent_name} onChange={handleChange} required icon={UserCircle2}/> <InputField label="Parent's Email" name="email" type="email" value={formData.parent_email} onChange={handleChange} icon={Mail}/> <InputField label="Parent's Phone" name="parent_phone" type="tel" value={formData.parent_phone} onChange={handleChange} icon={Phone}/> <InputField label="Requested Start Date" name="requested_start_date" type="date" value={formData.requested_start_date} onChange={handleChange} /> <TextAreaField label="Notes" name="notes" value={formData.notes} onChange={handleChange} rows={3} /> {isEditing && ( <SelectField label="Status" name="status" value={formData.status} onChange={handleChange}> <option value="Pending">Pending</option> <option value="Contacted">Contacted</option> <option value="Enrolled">Enrolled</option> <option value="Withdrawn">Withdrawn</option> </SelectField> )} <FormActions onCancel={onCancel} submitText={isEditing ? "Update Entry" : "Add to Waitlist"} submitIcon={isEditing ? CheckCircle : UserPlus} /> </form> </div> );
};

// --- GALLERY COMPONENT ---
const AdminGalleryPage = ({ dailyReports, loading, children, rooms, staff, currentUser }) => {
    if (loading && (!Array.isArray(dailyReports) || dailyReports.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading gallery...</div>;
    
    const childNameMap = Array.isArray(children) ? children.reduce((acc, child) => { acc[child.id] = child.name; return acc; }, {}) : {};
    const staffNameMap = Array.isArray(staff) ? staff.reduce((acc, s) => { acc[s.id] = s.name; return acc; }, {}) : {};

    let photos = [];
    if (Array.isArray(dailyReports)) {
        dailyReports.forEach(report => {
            if (report.photo_url_1 && typeof report.photo_url_1 === 'string' && report.photo_url_1.trim() !== '') {
                photos.push({ 
                    id: `${report.id}-photo1-${report.photo_url_1}`, 
                    url: report.photo_url_1, 
                    childName: childNameMap[report.child_id] || 'Unknown Child', 
                    reportDate: report.report_date, 
                    uploadedBy: staffNameMap[report.staff_id] || 'Unknown Staff',
                    child_id: report.child_id
                });
            }
            if (report.photo_url_2 && typeof report.photo_url_2 === 'string' && report.photo_url_2.trim() !== '') {
                photos.push({ 
                    id: `${report.id}-photo2-${report.photo_url_2}`, 
                    url: report.photo_url_2, 
                    childName: childNameMap[report.child_id] || 'Unknown Child', 
                    reportDate: report.report_date, 
                    uploadedBy: staffNameMap[report.staff_id] || 'Unknown Staff',
                    child_id: report.child_id
                });
            }
        });
    }

    if (currentUser?.role === 'parent' && currentUser.profileId) {
        const parentChildrenIds = Array.isArray(children) ? children.filter(c => c.primary_parent_id === currentUser.profileId).map(c => c.id) : [];
        photos = photos.filter(photo => photo.child_id && parentChildrenIds.includes(photo.child_id));
    }

    photos.sort((a, b) => new Date(b.reportDate) - new Date(a.reportDate));

    return (
        <div className="page-card">
            <div className="page-card-header">
                <h2 className="page-card-title">Photo Gallery (from Daily Reports)</h2>
            </div>
            {(!loading && photos.length === 0) ? (
                <InfoMessage 
                    message={currentUser?.role === 'parent' ? "No photos available for your child(ren) at the moment." : "No photos found in daily reports."} 
                    icon={ImageIcon}
                />
            ) : (
                <div className="gallery-grid">
                    {photos.map(photo => (
                        <div key={photo.id} className="gallery-item-card"> 
                            <img 
                                src={photo.url} 
                                alt={`Activity for ${photo.childName} on ${formatDateForInput(photo.reportDate)}`} 
                                className="gallery-item-image"  
                                onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/200x150/e2e8f0/94a3b8?text=Error"; }}
                            />
                            <div className="gallery-item-info">
                                <p className="gallery-item-caption">For: <strong>{photo.childName}</strong></p>
                                <p className="gallery-item-meta">
                                    Report Date: {formatDateForInput(photo.reportDate)} <br/> 
                                    Uploaded by: {photo.uploadedBy}
                                </p>
                                <div className="gallery-item-actions">
                                    <a href={photo.url} download target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-small gallery-download-button" title="Download Photo">
                                        <Download size={14} style={{marginRight: '0.25rem'}} /> Download
                                    </a>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- PARENT MANAGEMENT COMPONENTS ---
const AdminParentsPage = ({ parentsList, loading, onNavigateToAddParent, onEditParent, onDeleteParent }) => {
    if (loading && (!Array.isArray(parentsList) || parentsList.length === 0)) return <div className="loading-data-message"><Clock size={32} className="animate-spin-css"/> Loading parents...</div>;
    return ( <div className="page-card"> <div className="page-card-header"> <h2 className="page-card-title">Manage Parents/Guardians</h2> <button onClick={onNavigateToAddParent} className="btn btn-primary btn-small"><UserPlus size={18}/> Add New Parent</button> </div> {(!loading && (!Array.isArray(parentsList) || parentsList.length === 0)) ? ( <InfoMessage message="No parents found. Add a new parent to get started." icon={UserCog}/> ) : ( <div className="table-container"> <table className="data-table"> <thead> <tr> <th className="th-cell">Name</th> <th className="th-cell th-md-hidden">Email</th> <th className="th-cell th-lg-hidden">Phone</th> <th className="th-cell th-actions">Actions</th> </tr> </thead> <tbody> {Array.isArray(parentsList) && parentsList.map(parent => ( <tr key={parent.id} className="table-row"> <td className="td-cell td-name">{`${parent.first_name || ''} ${parent.last_name || ''}`.trim()}</td> <td className="td-cell th-md-hidden">{parent.email}</td> <td className="td-cell th-lg-hidden">{parent.phone_number || 'N/A'}</td> <td className="td-cell td-actions"> <button onClick={() => onEditParent(parent)} className="btn-icon table-action-button edit" title="Edit Parent"><Edit3 size={16}/></button> <button onClick={() => onDeleteParent(parent.id)} className="btn-icon table-action-button delete" title="Delete Parent"><Trash2 size={16}/></button> </td> </tr> ))} </tbody> </table> </div> )} </div> );
};
const AddParentPage = ({ onAddParent, onCancel, showAlert }) => {
    const [formData, setFormData] = useState({ first_name: '', last_name: '', email: '', phone_number: '', address_line1: '', address_line2: '', city: '', province_state: '', postal_code: '', country: '', });
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = (e) => { e.preventDefault(); if (!formData.first_name || !formData.last_name || !formData.email) { showAlert("First Name, Last Name, and Email are required for a parent.", "error"); return; } onAddParent(formData); };
    return ( <div className="page-card form-page-card"> <button onClick={onCancel} className="btn btn-secondary btn-small btn-back"><ArrowLeft size={18}/> Back to Parents</button> <h2 className="page-card-title form-page-title">Add New Parent/Guardian</h2> <form onSubmit={handleSubmit} className="form-layout"> <InputField label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} required icon={UserCircle2}/> <InputField label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} required /> <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required icon={Mail}/> <InputField label="Phone Number" name="phone_number" type="tel" value={formData.phone_number} onChange={handleChange} icon={Phone}/> <h3 className="form-section-title">Address (Optional)</h3> <InputField label="Address Line 1" name="address_line1" value={formData.address_line1} onChange={handleChange} /> <InputField label="Address Line 2" name="address_line2" value={formData.address_line2} onChange={handleChange} /> <InputField label="City" name="city" value={formData.city} onChange={handleChange} /> <InputField label="Province/State" name="province_state" value={formData.province_state} onChange={handleChange} /> <InputField label="Postal Code" name="postal_code" value={formData.postal_code} onChange={handleChange} /> <InputField label="Country" name="country" value={formData.country} onChange={handleChange} /> <FormActions onCancel={onCancel} submitText="Add Parent" submitIcon={UserPlus}/> </form> </div> );
};
const EditParentModal = ({ parent, onClose, onUpdateParent, showAlert }) => {
    const [formData, setFormData] = useState({ first_name: parent?.first_name || '', last_name: parent?.last_name || '', email: parent?.email || '', phone_number: parent?.phone_number || '', address_line1: parent?.address_line1 || '', address_line2: parent?.address_line2 || '', city: parent?.city || '', province_state: parent?.province_state || '', postal_code: parent?.postal_code || '', country: parent?.country || '', });
    useEffect(() => { if (parent) { setFormData({ first_name: parent.first_name || '', last_name: parent.last_name || '', email: parent.email || '', phone_number: parent.phone_number || '', address_line1: parent.address_line1 || '', address_line2: parent.address_line2 || '', city: parent.city || '', province_state: parent.province_state || '', postal_code: parent.postal_code || '', country: parent.country || '', }); } }, [parent]);
    const handleChange = (e) => { const { name, value } = e.target; setFormData(prev => ({ ...prev, [name]: value })); };
    const handleSubmit = (e) => { e.preventDefault(); if (!formData.first_name || !formData.last_name || !formData.email) { showAlert("First Name, Last Name, and Email are required.", "error"); return; } onUpdateParent({ ...formData, id: parent.id }); };
    if (!parent) return null;
    return ( <Modal onClose={onClose} title={`Edit ${parent.first_name} ${parent.last_name}`} size="large"> <form onSubmit={handleSubmit} className="form-layout modal-form"> <InputField label="First Name" name="first_name" value={formData.first_name} onChange={handleChange} required icon={UserCircle2}/> <InputField label="Last Name" name="last_name" value={formData.last_name} onChange={handleChange} required /> <InputField label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required icon={Mail}/> <InputField label="Phone Number" name="phone_number" type="tel" value={formData.phone_number} onChange={handleChange} icon={Phone}/> <h3 className="form-section-title">Address</h3> <InputField label="Address Line 1" name="address_line1" value={formData.address_line1} onChange={handleChange} /> <InputField label="Address Line 2" name="address_line2" value={formData.address_line2} onChange={handleChange} /> <InputField label="City" name="city" value={formData.city} onChange={handleChange} /> <InputField label="Province/State" name="province_state" value={formData.province_state} onChange={handleChange} /> <InputField label="Postal Code" name="postal_code" value={formData.postal_code} onChange={handleChange} /> <InputField label="Country" name="country" value={formData.country} onChange={handleChange} /> <FormActions onCancel={onClose} submitText="Save Changes" submitIcon={CheckCircle} /> </form> </Modal> );
};


// --- Main App Component Definition ---
const App = () => {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); 
  const [authActionLoading, setAuthActionLoading] = useState(false); 
  const [appMode, setAppMode] = useState('auth');
  const [currentUser, setCurrentUser] = useState(null); 
  const [currentPage, setCurrentPage] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);

  // Data states
  const [children, setChildren] = useState([]);
  const [staff, setStaff] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [dailyReports, setDailyReports] = useState([]);
  const [incidentReports, setIncidentReports] = useState([]);
  const [medications, setMedications] = useState([]);
  const [medicationLogs, setMedicationLogs] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [parentsList, setParentsList] = useState([]);


  const [loadingData, setLoadingData] = useState({
    children: false, staff: false, rooms: false, dailyReports: false, incidentReports: false,
    medications: false, medicationLogs: false, announcements: false, invoices: false, waitlistEntries: false,
    parentsList: false, parentForInvoice: false,
  });

  // Modal states & Edit states
  const [showEditChildModal, setShowEditChildModal] = useState(false);
  const [childToEdit, setChildToEdit] = useState(null);
  const [showViewDailyReportModal, setShowViewDailyReportModal] = useState(false);
  const [reportToView, setReportToView] = useState(null);
  const [showViewIncidentModal, setShowViewIncidentModal] = useState(false);
  const [incidentToView, setIncidentToView] = useState(null);
  const [childForMedications, setChildForMedications] = useState(null);
  const [showAddMedicationModal, setShowAddMedicationModal] = useState(false);
  const [showEditMedicationModal, setShowEditMedicationModal] = useState(false);
  const [medicationToEdit, setMedicationToEdit] = useState(null);
  const [showLogMedicationModal, setShowLogMedicationModal] = useState(false);
  const [medicationToLog, setMedicationToLog] = useState(null);
  const [announcementToEdit, setAnnouncementToEdit] = useState(null);
  const [waitlistEntryToEdit, setWaitlistEntryToEdit] = useState(null);
  const [showEditStaffModal, setShowEditStaffModal] = useState(false);
  const [staffToEdit, setStaffToEdit] = useState(null);
  const [showEditRoomModal, setShowEditRoomModal] = useState(false);
  const [roomToEdit, setRoomToEdit] = useState(null);
  const [showViewInvoiceModal, setShowViewInvoiceModal] = useState(false);
  const [invoiceToView, setInvoiceToView] = useState(null);
  const [parentDetailsForInvoice, setParentDetailsForInvoice] = useState(null);
  const [showEditParentModal, setShowEditParentModal] = useState(false);
  const [parentToEdit, setParentToEdit] = useState(null);


  const showAlert = useCallback((message, type = 'success') => { 
    console.log(`ALERT (${type}): ${message}`); 
    alert(`${type.toUpperCase()}: ${message}`); 
  }, []); // showAlert is now memoized

  // Auth useEffect
  useEffect(() => {
    setLoadingAuth(true); 

    const fetchUserProfile = async (user) => {
        if (!user) {
            return { role: 'unknown', name: 'User', profileId: null, staff_id: null };
        }
        
        try {
            const { data: staffProfile, error: staffError } = await supabase
                .from('staff')
                .select('id, name, role') 
                .eq('user_id', user.id)
                .single();
            
            if (staffError && staffError.code !== 'PGRST116') { 
                console.error("Error fetching staff profile:", staffError);
            }
            if (staffProfile) {
                return { 
                    role: staffProfile.role.toLowerCase(), 
                    name: staffProfile.name, 
                    profileId: staffProfile.id, 
                    staff_id: staffProfile.id 
                };
            }

            const { data: parentProfile, error: parentError } = await supabase
                .from('parents')
                .select('id, first_name, last_name') 
                .eq('user_id', user.id) 
                .single();

            if (parentError && parentError.code !== 'PGRST116') {
                console.error("Error fetching parent profile:", parentError);
            }
            if (parentProfile) {
                return { 
                    role: 'parent', 
                    name: `${parentProfile.first_name || ''} ${parentProfile.last_name || ''}`.trim(), 
                    profileId: parentProfile.id,
                    staff_id: null 
                };
            }
            
            console.warn(`User ${user.email} (ID: ${user.id}) has no linked profile in staff or parents table.`);
            return { role: 'unknown_profile', name: user.email, profileId: null, staff_id: null };

        } catch (e) {
            console.error("Exception fetching user profile:", e);
            return { role: 'exception_profile', name: user.email, profileId: null, staff_id: null };
        }
    };
    
    const processSessionChange = async (sessionData, eventType = null) => {
        setSession(sessionData);
        if (sessionData?.user) {
            const userProfileDetails = await fetchUserProfile(sessionData.user);
            setCurrentUser({ ...sessionData.user, ...userProfileDetails }); 
            setAppMode(userProfileDetails.role); 
            
            let initialPage = '';
            switch (userProfileDetails.role) {
                case 'admin': initialPage = 'AdminDashboard'; break;
                case 'teacher': initialPage = 'TeacherDashboard'; break;
                case 'assistant': initialPage = 'AssistantDashboard'; break;
                case 'parent': initialPage = 'ParentDashboard'; break;
                default: initialPage = 'UnknownRolePage';
            }
            
            const validRoleForDashboard = !['unknown', 'unknown_profile', 'no_parent_profile', 'exception_profile', 'auth'].includes(userProfileDetails.role);
            if ((eventType === 'INITIAL_SESSION_RESOLVED' || eventType === 'SIGNED_IN') && !currentPage && validRoleForDashboard) {
                setCurrentPage(initialPage);
            } else if (!currentPage && !validRoleForDashboard && userProfileDetails.role !== 'auth') { 
                setCurrentPage('UnknownRolePage');
            }
        } else {
            setAppMode('auth');
            setCurrentUser(null);
            setChildren([]); setStaff([]); setRooms([]); setDailyReports([]);
            setIncidentReports([]); setMedications([]); setMedicationLogs([]);
            setAnnouncements([]); setInvoices([]); setWaitlistEntries([]); 
            setParentsList([]);
            setCurrentPage('');
        }
        setLoadingAuth(false); 
    };

    supabase.auth.getSession()
        .then(({ data: { session: initialSession } }) => {
            processSessionChange(initialSession, 'INITIAL_SESSION_RESOLVED');
        })
        .catch((error) => { 
            console.error("Error getting initial session:", error);
            processSessionChange(null); 
        });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, sessionData) => {
        console.log("Auth state changed:", _event, sessionData);
        if (_event === 'SIGNED_OUT') {
            setLoadingAuth(true); 
        }
        processSessionChange(sessionData, _event);
    });

    return () => { 
        subscription?.unsubscribe(); 
    };
  }, [currentPage]); // showAlert removed from deps as it's now memoized


  // Generic fetchData function
  const fetchData = useCallback(async (dataType, setDataCallback, tableName, order = { column: 'created_at', ascending: false }, select = '*') => {
    if (!session) { setDataCallback([]); setLoadingData(prev => ({...prev, [dataType]: false})); return; }
    setLoadingData(prev => ({...prev, [dataType]: true}));
    try {
      const { data, error } = await supabase.from(tableName).select(select).order(order.column, { ascending: order.ascending });
      if (error) { console.error(`DEBUG: Supabase error fetching ${dataType} from ${tableName}:`, error); throw error; }
      setDataCallback(data || []);
    } catch (e) { showAlert(`Error fetching ${dataType}: ${e.message}`, 'error'); setDataCallback([]); }
    finally { setLoadingData(prev => ({...prev, [dataType]: false})); }
  }, [session, showAlert]);

  // Data fetching useEffect
  useEffect(() => {
    console.log("DEBUG: Data fetching useEffect. Session:", !!session, "AppMode:", appMode);
    if (session && appMode && appMode !== 'auth' && !['unknown', 'unknown_profile', 'no_parent_profile', 'exception_profile'].includes(appMode) ) {
        console.log("DEBUG: Conditions for data fetch MET. Fetching data for role:", appMode);
        fetchData('rooms', setRooms, 'rooms', { column: 'name', ascending: true });
        fetchData('announcements', setAnnouncements, 'announcements', { column: 'publish_date', ascending: false });
        
        fetchData('children', setChildren, 'children', { column: 'name', ascending: true }, '*, parents!primary_parent_id(id, first_name, last_name, email), check_in_time, check_out_time, current_room_id');
        
        if (appMode === 'admin' || appMode === 'teacher' || appMode === 'assistant') {
            fetchData('staff', setStaff, 'staff', { column: 'name', ascending: true });
            fetchData('dailyReports', setDailyReports, 'daily_reports', { column: 'report_date', ascending: false });
            fetchData('medications', setMedications, 'medications', { column: 'medication_name', ascending: true });
        } else if (appMode === 'parent') {
            fetchData('dailyReports', setDailyReports, 'daily_reports', { column: 'report_date', ascending: false });
            fetchData('invoices', setInvoices, 'invoices', { column: 'invoice_date', ascending: false });
        }
        
        if (appMode === 'admin') {
            fetchData('incidentReports', setIncidentReports, 'incident_reports', { column: 'incident_datetime', ascending: false });
            fetchData('medicationLogs', setMedicationLogs, 'medication_logs', { column: 'administered_at', ascending: false });
            fetchData('invoices', setInvoices, 'invoices', { column: 'invoice_date', ascending: false });
            fetchData('waitlistEntries', setWaitlistEntries, 'waitlist_entries', { column: 'created_at', ascending: true });
            fetchData('parentsList', setParentsList, 'parents', { column: 'last_name', ascending: true });
        }
    } else {
        console.log("DEBUG: Conditions for data fetch not met or appMode not ready/valid:", appMode);
    }
  }, [session, appMode, fetchData, currentUser]);

  // Real-time subscriptions useEffect
  useEffect(() => {
    let mainChannel;
    if (session && supabase?.channel && appMode && appMode !== 'auth' && !['unknown', 'unknown_profile', 'no_parent_profile', 'exception_profile'].includes(appMode)) {
      const childrenSelectStringRealtime = '*, parents!primary_parent_id(id, first_name, last_name, email, phone_number, address_line1, city, province_state, postal_code), check_in_time, check_out_time, current_room_id';
      const tablesToSubscribe = [
          { name: 'children', setter: setChildren, order: { column: 'name', ascending: true }, select: childrenSelectStringRealtime },
          { name: 'staff', setter: setStaff, order: { column: 'name', ascending: true } },
          { name: 'rooms', setter: setRooms, order: { column: 'name', ascending: true } },
          { name: 'daily_reports', setter: setDailyReports, order: { column: 'report_date', ascending: false } },
          { name: 'incident_reports', setter: setIncidentReports, order: { column: 'incident_datetime', ascending: false } },
          { name: 'medications', setter: setMedications, order: { column: 'medication_name', ascending: true } },
          { name: 'medication_logs', setter: setMedicationLogs, order: { column: 'administered_at', ascending: false } },
          { name: 'announcements', setter: setAnnouncements, order: { column: 'publish_date', ascending: false } },
          { name: 'invoices', setter: setInvoices, order: { column: 'invoice_date', ascending: false } },
          { name: 'waitlist_entries', setter: setWaitlistEntries, order: { column: 'created_at', ascending: true } },
          { name: 'parents', setter: setParentsList, order: { column: 'last_name', ascending: true } },
      ];
      mainChannel = supabase.channel(`app-data-updates-${appMode}-v31-realtime`); 
      tablesToSubscribe.forEach(table => {
          mainChannel.on('postgres_changes', { event: '*', schema: 'public', table: table.name }, (payload) => {
              console.log(`Realtime update for ${table.name}:`, payload);
              fetchData(table.name, table.setter, table.name, table.order, table.select || '*');
          });
      });
      mainChannel.subscribe(status => console.log(`DEBUG: Supabase channel status for ${mainChannel.topic}:`, status));
    }
    return () => { if (mainChannel) supabase.removeChannel(mainChannel); };
  }, [session, appMode, fetchData]);


  // --- ALL CRUD OPERATIONS ---
  const handleViewReportDetails = useCallback((report) => { 
    setReportToView(report); 
    setShowViewDailyReportModal(true); 
  }, [setReportToView, setShowViewDailyReportModal]); 

  const handleViewInvoiceDetails = useCallback(async (invoice) => {
    setInvoiceToView(invoice);
    const childForInvoice = children.find(c => c.id === invoice.child_id);
    if (childForInvoice && childForInvoice.primary_parent_id) {
        setLoadingData(prev => ({...prev, parentForInvoice: true}));
        try {
            if (childForInvoice.parents) { 
                setParentDetailsForInvoice(childForInvoice.parents); 
            } else { 
                const { data: parentData, error: parentError } = await supabase
                    .from('parents')
                    .select('*')
                    .eq('id', childForInvoice.primary_parent_id)
                    .single(); 
                if (parentError) throw parentError; 
                setParentDetailsForInvoice(parentData); 
            }
        } catch (e) { 
            showAlert(`Error fetching parent details: ${e.message}`, 'error'); 
            setParentDetailsForInvoice(null); 
        }
        finally { setLoadingData(prev => ({...prev, parentForInvoice: false})); }
    } else { 
        setParentDetailsForInvoice(null); 
        if (childForInvoice && !childForInvoice.primary_parent_id) { 
            // console.warn("Child has no primary parent linked for invoice details.");
        } else if (!childForInvoice) { 
            showAlert("Child record not found for invoice.", "error");
        }
    }
    setShowViewInvoiceModal(true);
  }, [children, showAlert, setInvoiceToView, setShowViewInvoiceModal, setParentDetailsForInvoice, setLoadingData]); 

  // Children CRUD
  const addChildToSupabase = useCallback(async (childFormData) => {
    const { parent_first_name, parent_last_name, parent_email, parent_phone_number, ...childSpecificData } = childFormData;
    if (!childSpecificData.primary_parent_id) { showAlert("Primary Parent is required.", "error"); return; }
    if (childSpecificData.current_room_id === '') { childSpecificData.current_room_id = null; }
    try { const { error } = await supabase.from('children').insert([childSpecificData]); if (error) throw error; showAlert('Child added successfully!'); setCurrentPage('Children');
    } catch (e) { showAlert(`Add child error: ${e.message}`, 'error'); console.error("Add child error:", e); }
  }, [showAlert, setCurrentPage]); 

  const handleOpenEditChildModal = useCallback((child) => { setChildToEdit(child); setShowEditChildModal(true); }, []);

  const updateChildInSupabase = useCallback(async (updatedChildData) => {
    if (!childToEdit?.id) return;
    try { const {id, ...dataToUpdate} = updatedChildData; if (dataToUpdate.current_room_id === '') { dataToUpdate.current_room_id = null; } const {error}=await supabase.from('children').update(dataToUpdate).eq('id', childToEdit.id); if(error) throw error; showAlert('Child updated!'); setShowEditChildModal(false); setChildToEdit(null);
    } catch(e){ showAlert(`Update child error: ${e.message}`,'error'); }
  }, [showAlert, childToEdit]); 

  const deleteChildFromSupabase = useCallback(async (childId) => { 
    if (!window.confirm("Are you sure you want to delete this child? This action cannot be undone.")) return; 
    try {const {error}=await supabase.from('children').delete().eq('id', childId); if(error) throw error; showAlert('Child deleted!');
    }catch(e){showAlert(`Delete child error: ${e.message}`,'error');}
  }, [showAlert]); 

  const toggleChildCheckInStatus = useCallback(async (childId) => { 
    const child = children.find(c=>c.id===childId); 
    if(!child) return; 
    const now = new Date().toISOString(); 
    const wasCheckedIn = child.check_in_time && !child.check_out_time; 
    const updates = {check_in_time: wasCheckedIn ? child.check_in_time : now, check_out_time: wasCheckedIn ? now : null}; 
    try {const {error}=await supabase.from('children').update(updates).eq('id', childId); if(error) throw error; showAlert(`Child ${wasCheckedIn?'checked out':'checked in'} successfully!`)}
    catch(e){showAlert(`Check-in/out error: ${e.message}`,'error');}
  }, [children, showAlert]); 
  
  // Staff CRUD
  const addStaffToSupabase = useCallback(async (staffData) => {
    try {
        const { data: existingStaff, error: findError } = await supabase
            .from('staff')
            .select('id, email')
            .eq('email', staffData.email)
            .single();

        if (findError && findError.code !== 'PGRST116') { 
            throw findError;
        }
        if (existingStaff) {
            showAlert(`Staff with email ${staffData.email} already exists.`, 'warning');
            return;
        }

        const dataToInsert = {...staffData};
        dataToInsert.role = dataToInsert.role?.toLowerCase(); 

        if (dataToInsert.role !== 'teacher') {
            dataToInsert.main_room_id = null;
        } else if (!dataToInsert.main_room_id || dataToInsert.main_room_id === '') { 
            dataToInsert.main_room_id = null; 
        }
        dataToInsert.user_id = dataToInsert.email === currentUser?.email ? currentUser.id : null;
        const {error}=await supabase.from('staff').insert([dataToInsert]);
        if(error) { throw error; }
        showAlert('Staff added!'); setCurrentPage('Staff');
    } catch(e){ showAlert(`Add staff error: ${e.message}`,'error'); console.error("DEBUG: addStaffToSupabase - Catch block error:", e); }
  }, [showAlert, setCurrentPage, currentUser]); 

  const handleOpenEditStaffModal = useCallback((staffMember) => { setStaffToEdit(staffMember); setShowEditStaffModal(true); }, []);

  const updateStaffInSupabase = useCallback(async (updatedStaffData) => {
    if (!staffToEdit?.id) return;
    try {
        const { id, ...dataToUpdate } = updatedStaffData;
        dataToUpdate.role = dataToUpdate.role?.toLowerCase();

        if (dataToUpdate.role !== 'teacher') {
            dataToUpdate.main_room_id = null;
        } else if (dataToUpdate.main_room_id === '' || dataToUpdate.main_room_id === undefined) {
            dataToUpdate.main_room_id = null;
        }
        
        const { error } = await supabase.from('staff').update(dataToUpdate).eq('id', staffToEdit.id);
        if (error) { throw error; }
        showAlert('Staff member updated successfully!'); setShowEditStaffModal(false); setStaffToEdit(null);
    } catch (e) { showAlert(`Error updating staff member: ${e.message}`, 'error'); console.error("DEBUG: Catch block in updateStaffInSupabase:", e); }
  }, [showAlert, staffToEdit]); 

  const deleteStaffFromSupabase = useCallback(async (staffId) => { 
    if (!window.confirm("Are you sure you want to delete this staff member?")) return; 
    try { const { error } = await supabase.from('staff').delete().eq('id', staffId); if (error) throw error; showAlert('Staff member deleted!'); 
    } catch (e) { showAlert(`Delete staff error: ${e.message}`, 'error');}
  }, [showAlert]); 

  // Room CRUD
  const addRoomToSupabase = useCallback(async (roomData) => { 
    try {const {error} = await supabase.from('rooms').insert([roomData]); if(error) throw error; showAlert('Room added!'); setCurrentPage('Rooms'); 
    } catch(e){showAlert(`Add room error: ${e.message}`,'error');}
  }, [showAlert, setCurrentPage]); 

  const handleOpenEditRoomModal = useCallback((room) => { setRoomToEdit(room); setShowEditRoomModal(true); }, []);

  const updateRoomInSupabase = useCallback(async (updatedRoomData) => { 
    if (!roomToEdit?.id) return; 
    try { const { id, ...dataToUpdate } = updatedRoomData; const { error } = await supabase.from('rooms').update(dataToUpdate).eq('id', roomToEdit.id); if (error) throw error; showAlert('Room updated!'); setShowEditRoomModal(false); setRoomToEdit(null); 
    } catch (e) { showAlert(`Update room error: ${e.message}`, 'error');}
  }, [showAlert, roomToEdit]); 

  const deleteRoomFromSupabase = useCallback(async (roomId) => { 
    if (!window.confirm("Are you sure you want to delete this room?")) return; 
    try { const { error } = await supabase.from('rooms').delete().eq('id', roomId); if (error) throw error; showAlert('Room deleted!'); 
    } catch (e) { showAlert(`Delete room error: ${e.message}`, 'error');}
  }, [showAlert]); 

  // Daily Reports CRUD
  const addDailyReportToSupabase = useCallback(async (reportData) => {
    if (!currentUser?.staff_id) { showAlert("Cannot create report: Staff profile not loaded or staff ID missing.", "error"); return; }
    const dataWithStaffId = { ...reportData, staff_id: currentUser.staff_id };
    try {
        const { error } = await supabase.from('daily_reports').insert([dataWithStaffId]).select();
        if (error) throw error;
        showAlert('Daily report added successfully!');
        setCurrentPage(appMode === 'admin' ? 'AdminDailyReports' : (appMode === 'teacher' || appMode === 'assistant' ? 'AdminDailyReports' : 'ParentDashboard'));
    } catch (e) { showAlert(`Error adding daily report: ${e.message}`, 'error'); console.error("Error details for addDailyReportToSupabase:", e); }
  }, [showAlert, currentUser, appMode, setCurrentPage]); 

  // Incident Reports CRUD
  const addIncidentReportToSupabase = useCallback(async (incidentData) => {
    if (!currentUser?.staff_id) { showAlert("Cannot log incident: Staff profile not loaded or staff ID missing.", "error"); return; }
    const dataWithStaffId = { ...incidentData, reported_by_staff_id: currentUser.staff_id };
    try {
        const { error } = await supabase.from('incident_reports').insert([dataWithStaffId]).select();
        if (error) throw error;
        showAlert('Incident report logged!');
        setCurrentPage('AdminIncidentReports');
    } catch (e) { showAlert(`Log incident error: ${e.message}`, 'error'); console.error(e); }
  }, [showAlert, currentUser, setCurrentPage]); 

  const handleViewIncidentDetails = useCallback((incident) => { 
    setIncidentToView(incident); 
    setShowViewIncidentModal(true); 
  }, [setIncidentToView, setShowViewIncidentModal]); 

  // Medications CRUD
  const handleNavigateToChildMedications = useCallback((child) => { setChildForMedications(child); setCurrentPage('ChildMedicationsPage'); }, [setCurrentPage]);
  const handleOpenAddMedicationModal = useCallback((childId) => { setChildForMedications(children.find(c => c.id === childId) || childForMedications); setShowAddMedicationModal(true); }, [children, childForMedications]);
  const handleOpenEditMedicationModal = useCallback((medication) => { setMedicationToEdit(medication); setShowEditMedicationModal(true); }, []);
  const handleOpenLogAdministrationModal = useCallback((medication) => { setMedicationToLog(medication); setShowLogMedicationModal(true); }, []);

  const addMedicationToSupabase = useCallback(async (medData) => { try { const { error } = await supabase.from('medications').insert([medData]).select(); if (error) throw error; showAlert('Medication added!'); setShowAddMedicationModal(false); } catch (e) { showAlert(`Add medication error: ${e.message}`, 'error'); } }, [showAlert]); 
  const updateMedicationInSupabase = useCallback(async (medData) => { if (!medData.id) return; try { const {id, ...dataToUpdate} = medData; const { error } = await supabase.from('medications').update(dataToUpdate).eq('id', id).select(); if (error) throw error; showAlert('Medication updated!'); setShowEditMedicationModal(false); setMedicationToEdit(null); } catch (e) { showAlert(`Update medication error: ${e.message}`, 'error');} }, [showAlert]); 
  const deleteMedicationFromSupabase = useCallback(async (medicationId) => { if (!window.confirm("Delete medication?")) return; try { const { error } = await supabase.from('medications').delete().eq('id', medicationId); if (error) throw error; showAlert('Medication deleted!'); } catch (e) { showAlert(`Delete medication error: ${e.message}`, 'error'); } }, [showAlert]); 
  const addMedicationLogToSupabase = useCallback(async (logData) => {
    if (!currentUser?.staff_id) { showAlert("Cannot log medication: Staff profile not loaded or staff ID missing.", "error"); return; }
    const dataWithStaffId = { ...logData, administered_by_staff_id: currentUser.staff_id };
    try {
        const { error } = await supabase.from('medication_logs').insert([dataWithStaffId]).select();
        if (error) throw error;
        showAlert('Medication administration logged!');
        setShowLogMedicationModal(false);
        setMedicationToLog(null);
    } catch (e) { showAlert(`Log med admin error: ${e.message}`, 'error');}
  }, [showAlert, currentUser]); 

  // Announcements CRUD
  const handleNavigateToCreateAnnouncement = useCallback(() => { setAnnouncementToEdit(null); setCurrentPage('CreateAnnouncementPage'); }, [setCurrentPage]);
  const handleEditAnnouncement = useCallback((announcement) => { setAnnouncementToEdit(announcement); setCurrentPage('CreateAnnouncementPage'); }, [setCurrentPage]);
  const addAnnouncementToSupabase = useCallback(async (announcementData) => {
    if (!currentUser?.staff_id) { showAlert("Cannot create announcement: Staff profile not loaded or staff ID missing.", "error"); return; }
    const dataWithStaffId = { ...announcementData, author_staff_id: currentUser.staff_id };
    try {
        const { error } = await supabase.from('announcements').insert([dataWithStaffId]).select();
        if (error) throw error;
        showAlert('Announcement created!');
        setCurrentPage('AdminAnnouncements');
    } catch (e) { showAlert(`Create announcement error: ${e.message}`, 'error'); }
  }, [showAlert, currentUser, setCurrentPage]); 

  const updateAnnouncementInSupabase = useCallback(async (announcementData) => {
    if (!announcementData.id) return;
    if (!currentUser?.staff_id) { showAlert("Cannot update announcement: Staff profile not loaded or staff ID missing.", "error"); return; }
    const {id, ...dataToUpdate} = announcementData;
    const dataWithStaffId = { ...dataToUpdate, author_staff_id: currentUser.staff_id };
    try {
        const { error } = await supabase.from('announcements').update(dataWithStaffId).eq('id', id).select();
        if (error) throw error;
        showAlert('Announcement updated!');
        setCurrentPage('AdminAnnouncements');
        setAnnouncementToEdit(null);
    } catch (e) { showAlert(`Update announcement error: ${e.message}`, 'error'); }
  }, [showAlert, currentUser, setCurrentPage]); 

  const deleteAnnouncementFromSupabase = useCallback(async (announcementId) => { if (!window.confirm("Delete announcement?")) return; try { const { error } = await supabase.from('announcements').delete().eq('id', announcementId); if (error) throw error; showAlert('Announcement deleted!'); } catch (e) { showAlert(`Delete announcement error: ${e.message}`, 'error'); } }, [showAlert]); 

  // Billing CRUD
  const addInvoiceToSupabase = useCallback(async (invoiceData) => {
    let dataWithCreator = { ...invoiceData };
    if (currentUser && ['admin', 'teacher', 'assistant'].includes(currentUser.role) && currentUser.staff_id) {
        dataWithCreator.created_by_staff_id = currentUser.staff_id;
    }
    try {
      const { error } = await supabase.from('invoices').insert([dataWithCreator]).select();
      if (error) throw error;
      showAlert('Invoice created!'); setCurrentPage('AdminBilling');
    } catch (e) { showAlert(`Create invoice error: ${e.message}`, 'error'); console.error("Create invoice error:", e); }
  }, [showAlert, currentUser, setCurrentPage]); 

  // Waitlist CRUD
  const handleNavigateToAddWaitlistEntry = useCallback(() => { setWaitlistEntryToEdit(null); setCurrentPage('AddToWaitlistPage'); }, [setCurrentPage]);
  const handleEditWaitlistEntry = useCallback((entry) => { setWaitlistEntryToEdit(entry); setCurrentPage('AddToWaitlistPage'); }, [setCurrentPage]);
  const addOrUpdateWaitlistEntryToSupabase = useCallback(async (entryData, isEditing) => { try { let error; const dataToProcess = { ...entryData }; if (isEditing) { const {id, ...dataToUpdate} = dataToProcess; ({ error } = await supabase.from('waitlist_entries').update(dataToUpdate).eq('id', id).select()); } else { delete dataToProcess.id; ({ error } = await supabase.from('waitlist_entries').insert([dataToProcess]).select()); } if (error) throw error; showAlert(`Waitlist entry ${isEditing ? 'updated' : 'added'}!`); setCurrentPage('AdminWaitlist'); setWaitlistEntryToEdit(null); } catch (e) { showAlert(`Waitlist error: ${e.message}`, 'error'); console.error("Waitlist error:", e); } }, [showAlert, setCurrentPage]); 
  const deleteWaitlistEntryFromSupabase = useCallback(async (entryId) => { if (!window.confirm("Remove from waitlist?")) return; try { const { error } = await supabase.from('waitlist_entries').delete().eq('id', entryId); if (error) throw error; showAlert('Waitlist entry removed!'); } catch (e) { showAlert(`Delete waitlist entry error: ${e.message}`, 'error'); } }, [showAlert]); 

  // Parent CRUD
  const addParentToSupabase = useCallback(async (parentData) => {
    try {
        const { data: existingParent, error: findError } = await supabase.from('parents').select('id, email').eq('email', parentData.email).single();
        if (findError && findError.code !== 'PGRST116') { throw findError; }
        if (existingParent) { showAlert(`Parent with email ${parentData.email} already exists.`, 'warning'); return; }
        const { error } = await supabase.from('parents').insert([parentData]).select();
        if (error) throw error;
        showAlert('Parent added successfully!'); setCurrentPage('AdminParents');
    } catch (e) { showAlert(`Error adding parent: ${e.message}`, 'error'); console.error("Error adding parent:", e); }
  }, [showAlert, setCurrentPage]); 

  const handleOpenEditParentModal = useCallback((parent) => { setParentToEdit(parent); setShowEditParentModal(true); }, []);

  const updateParentInSupabase = useCallback(async (updatedParentData) => {
    if (!parentToEdit?.id) return;
    try {
        const { id, ...dataToUpdate } = updatedParentData;
        const { error } = await supabase.from('parents').update(dataToUpdate).eq('id', id);
        if (error) throw error;
        showAlert('Parent details updated!'); setShowEditParentModal(false); setParentToEdit(null);
    } catch (e) { showAlert(`Error updating parent: ${e.message}`, 'error'); console.error("Error updating parent:", e); }
  }, [showAlert, parentToEdit]); 

  const deleteParentFromSupabase = useCallback(async (parentId) => {
    if (!window.confirm("Delete parent? This may affect linked children.")) return;
    try {
        const { data: linkedChildren, error: childrenCheckError } = await supabase.from('children').select('id').eq('primary_parent_id', parentId);
        if (childrenCheckError) { showAlert(`Error checking linked children: ${childrenCheckError.message}`, 'error'); return; }
        if (linkedChildren && linkedChildren.length > 0) { showAlert(`Parent is linked to ${linkedChildren.length} child(ren). Reassign children first.`, 'error'); return; }
        const { error } = await supabase.from('parents').delete().eq('id', parentId);
        if (error) throw error;
        showAlert('Parent deleted successfully!');
    } catch (e) { showAlert(`Error deleting parent: ${e.message}`, 'error'); console.error("Error deleting parent:", e); }
  }, [showAlert]); 
  
  // Auth Handlers
  const handleSignUp = async (email, password) => { 
    setAuthActionLoading(true); 
    try {
        const { error } = await supabase.auth.signUp({ // data variable removed
            email,
            password,
            options: {
              // data: { first_name: 'John', last_name: 'Doe' }
            }
        }); 
        if(error) throw error; 
        showAlert('Signup successful! Please check your email to confirm.');
    } catch(e) {
        showAlert(`Signup error: ${e.message}`,'error');
    } finally {
        setAuthActionLoading(false);
    }
  };
  const handleSignIn = async (email, password) => { 
    setAuthActionLoading(true); 
    try {
        const {error} = await supabase.auth.signInWithPassword({email,password}); 
        if(error) throw error; 
    } catch(e) {
        showAlert(`Signin error: ${e.message}`,'error');
    } finally {
        setAuthActionLoading(false);
    }
  };
  const handleSignOut = async () => { 
    setAuthActionLoading(true); 
    const { error } = await supabase.auth.signOut(); 
    if (error) {
        showAlert(`Signout error: ${error.message}`, 'error');
    }
    setAuthActionLoading(false);
  };


  // Navigation definitions
  const adminNav = [ { name: 'AdminDashboard', label: 'Dashboard', icon: HomeIcon }, { name: 'Children', label: 'Children', icon: Smile }, { name: 'Staff', label: 'Staff', icon: UsersIconAliased }, { name: 'AdminParents', label: 'Parents', icon: UserCog }, { name: 'Rooms', label: 'Rooms', icon: Building }, { name: 'AdminDailyReports', label: 'Daily Reports', icon: FileText }, { name: 'AdminIncidentReports', label: 'Incident Reports', icon: ShieldAlert }, { name: 'AdminGallery', label: 'Gallery', icon: Camera }, { name: 'AdminAnnouncements', label: 'Announcements', icon: Megaphone }, { name: 'AdminBilling', label: 'Billing', icon: DollarSign }, { name: 'AdminWaitlist', label: 'Waitlist', icon: ListOrdered }, ];
  const teacherNav = [ { name: 'TeacherDashboard', label: 'Dashboard', icon: HomeIcon }, { name: 'AdminDailyReports', label: 'Daily Reports', icon: FileText }, { name: 'AdminGallery', label: 'Gallery', icon: Camera }, { name: 'AdminAnnouncements', label: 'Announcements', icon: Megaphone } ];
  const assistantNav = [ { name: 'AssistantDashboard', label: 'Dashboard', icon: HomeIcon }, { name: 'AdminDailyReports', label: 'Create Report', icon: FileText }, { name: 'AdminGallery', label: 'Gallery', icon: Camera } ];
  
  const parentNav = [
    { name: 'ParentDashboard', label: 'Dashboard', icon: HomeIcon },
    { name: 'ParentDailyReports', label: 'Daily Reports', icon: FileText },
    { name: 'ParentInvoices', label: 'Invoices', icon: DollarSign },
    { name: 'AdminGallery', label: 'Photo Gallery', icon: Camera },
    { name: 'AdminAnnouncements', label: 'Announcements', icon: Megaphone }
  ];

  let currentNavItems = []; let currentPortalName = "Daycare Portal";
  switch (appMode) { case 'admin': currentNavItems = adminNav; currentPortalName = "Admin Portal"; break; case 'teacher': currentNavItems = teacherNav; currentPortalName = "Teacher Portal"; break; case 'assistant': currentNavItems = assistantNav; currentPortalName = "Assistant Portal"; break; case 'parent': currentNavItems = parentNav; currentPortalName = "Parent Portal"; break; default: currentNavItems = []; currentPortalName = "Welcome"; }


  // --- renderCurrentPage function ---
  const renderCurrentPage = () => {
    if (loadingAuth && appMode === 'auth' && !session) { 
        return <div className="loading-screen"><Clock size={48} className="animate-spin-css" /> <span>Initializing App...</span></div>;
    }
    if (loadingAuth && session && !currentUser) { 
        return <div className="loading-screen"><Clock size={48} className="animate-spin-css" /> <span>Loading Profile...</span></div>;
    }

    switch (appMode) {
      case 'admin':
        switch (currentPage) {
            case 'AdminDashboard': return <AdminDashboardPage />;
            case 'Children': return <ChildrenPage childrenList={children} loading={loadingData.children} onNavigateToAddChild={()=>setCurrentPage('AddChildPage')} onEditChild={handleOpenEditChildModal} onDeleteChild={deleteChildFromSupabase} onToggleCheckIn={toggleChildCheckInStatus} onNavigateToChildMedications={handleNavigateToChildMedications} />;
            case 'AddChildPage': return <AddChildPage onAddChild={addChildToSupabase} onCancel={() => setCurrentPage('Children')} showAlert={showAlert} parentsList={parentsList} rooms={rooms} />;
            case 'Staff': return <StaffPage staffList={staff} loading={loadingData.staff} onNavigateToAddStaff={() => setCurrentPage('AddStaffPage')} onEditStaff={handleOpenEditStaffModal} onDeleteStaff={deleteStaffFromSupabase} rooms={rooms} />;
            case 'AddStaffPage': return <AddStaffPage onAddStaff={addStaffToSupabase} onCancel={() => setCurrentPage('Staff')} currentUser={currentUser} showAlert={showAlert} rooms={rooms} />;
            case 'AdminParents': return <AdminParentsPage parentsList={parentsList} loading={loadingData.parentsList} onNavigateToAddParent={() => setCurrentPage('AddParentPage')} onEditParent={handleOpenEditParentModal} onDeleteParent={deleteParentFromSupabase} />;
            case 'AddParentPage': return <AddParentPage onAddParent={addParentToSupabase} onCancel={() => setCurrentPage('AdminParents')} showAlert={showAlert} />;
            case 'Rooms': return <RoomManagementPage rooms={rooms} loading={loadingData.rooms} onNavigateToAddRoom={() => setCurrentPage('AddRoomPage')} onEditRoom={handleOpenEditRoomModal} onDeleteRoom={deleteRoomFromSupabase} />;
            case 'AddRoomPage': return <AddRoomPage onAddRoom={addRoomToSupabase} onCancel={() => setCurrentPage('Rooms')} />;
            case 'AdminDailyReports': return <AdminDailyReportsPage dailyReports={dailyReports} children={children} staff={staff} loading={loadingData.dailyReports} onNavigateToCreateReport={() => setCurrentPage('CreateDailyReportPage')} onViewReportDetails={handleViewReportDetails} />;
            case 'CreateDailyReportPage': return <CreateDailyReportPage children={children} staff={staff} currentUser={currentUser} onAddDailyReport={addDailyReportToSupabase} onCancel={() => setCurrentPage('AdminDailyReports')} showAlert={showAlert} />;
            case 'AdminIncidentReports': return <AdminIncidentReportsPage incidentReports={incidentReports} children={children} staff={staff} loading={loadingData.incidentReports} onNavigateToLogIncident={() => setCurrentPage('LogIncidentPage')} onViewIncidentDetails={handleViewIncidentDetails} />;
            case 'LogIncidentPage': return <LogIncidentPage children={children} staff={staff} currentUser={currentUser} onLogIncident={addIncidentReportToSupabase} onCancel={() => setCurrentPage('AdminIncidentReports')} showAlert={showAlert} />;
            case 'ChildMedicationsPage': return childForMedications ? <ChildMedicationsPage child={childForMedications} medications={medications} onOpenAddMedicationModal={handleOpenAddMedicationModal} onOpenEditMedicationModal={handleOpenEditMedicationModal} onOpenLogAdministrationModal={handleOpenLogAdministrationModal} onDeleteMedication={deleteMedicationFromSupabase} onCancel={() => {setChildForMedications(null); setCurrentPage('Children');}} /> : <InfoMessage message="Select child for meds." type="info"/>;
            case 'AdminAnnouncements': return <AdminAnnouncementsPage announcements={announcements} staff={staff} loading={loadingData.announcements} onNavigateToCreateAnnouncement={handleNavigateToCreateAnnouncement} onEditAnnouncement={handleEditAnnouncement} onDeleteAnnouncement={deleteAnnouncementFromSupabase} />;
            case 'CreateAnnouncementPage': return <CreateAnnouncementPage onAddAnnouncement={addAnnouncementToSupabase} onUpdateAnnouncement={updateAnnouncementInSupabase} onCancel={() => {setAnnouncementToEdit(null); setCurrentPage('AdminAnnouncements');}} currentUser={currentUser} initialData={announcementToEdit} showAlert={showAlert} />;
            case 'AdminBilling': return <AdminBillingPage invoices={invoices} children={children} loading={loadingData.invoices} onNavigateToCreateInvoice={() => setCurrentPage('CreateInvoicePage')} onViewInvoiceDetails={handleViewInvoiceDetails} />;
            case 'CreateInvoicePage': return <CreateInvoicePage children={children} onAddInvoice={addInvoiceToSupabase} onCancel={() => setCurrentPage('AdminBilling')} showAlert={showAlert} />;
            case 'AdminWaitlist': return <AdminWaitlistPage waitlistEntries={waitlistEntries} loading={loadingData.waitlistEntries} onNavigateToAddWaitlistEntry={handleNavigateToAddWaitlistEntry} onEditWaitlistEntry={handleEditWaitlistEntry} onDeleteWaitlistEntry={deleteWaitlistEntryFromSupabase} />;
            case 'AddToWaitlistPage': return <AddToWaitlistPage onAddOrUpdateWaitlistEntry={addOrUpdateWaitlistEntryToSupabase} onCancel={() => {setWaitlistEntryToEdit(null); setCurrentPage('AdminWaitlist');}} showAlert={showAlert} initialData={waitlistEntryToEdit} />;
            case 'AdminGallery': return <AdminGalleryPage dailyReports={dailyReports} children={children} staff={staff} loading={loadingData.dailyReports || loadingData.children || loadingData.staff} currentUser={currentUser} />;
            default: 
                if (!currentPage && session) { setCurrentPage('AdminDashboard'); return null; } 
                return <AdminDashboardPage />; 
        }

      case 'teacher':
        switch (currentPage) {
            case 'TeacherDashboard': return <TeacherDashboardPage />;
            case 'AdminDailyReports': return <AdminDailyReportsPage dailyReports={dailyReports} children={children} staff={staff} loading={loadingData.dailyReports} onNavigateToCreateReport={() => setCurrentPage('CreateDailyReportPage')} onViewReportDetails={handleViewReportDetails} />;
            case 'CreateDailyReportPage': return <CreateDailyReportPage children={children} staff={staff} currentUser={currentUser} onAddDailyReport={addDailyReportToSupabase} onCancel={() => setCurrentPage('AdminDailyReports')} showAlert={showAlert} />;
            case 'AdminGallery': return <AdminGalleryPage dailyReports={dailyReports} children={children} staff={staff} loading={loadingData.dailyReports || loadingData.children || loadingData.staff} currentUser={currentUser} />;
            case 'AdminAnnouncements': return <AdminAnnouncementsPage announcements={announcements} staff={staff} loading={loadingData.announcements} onNavigateToCreateAnnouncement={handleNavigateToCreateAnnouncement} onEditAnnouncement={handleEditAnnouncement} onDeleteAnnouncement={deleteAnnouncementFromSupabase} />;
            default: 
                if (!currentPage && session) { setCurrentPage('TeacherDashboard'); return null; }
                return <TeacherDashboardPage />;
        }

      case 'assistant':
         switch (currentPage) {
            case 'AssistantDashboard': return <AssistantDashboardPage />;
            case 'AdminDailyReports': return <AdminDailyReportsPage dailyReports={dailyReports} children={children} staff={staff} loading={loadingData.dailyReports} onNavigateToCreateReport={() => setCurrentPage('CreateDailyReportPage')} onViewReportDetails={handleViewReportDetails} />;
            case 'CreateDailyReportPage': return <CreateDailyReportPage children={children} staff={staff} currentUser={currentUser} onAddDailyReport={addDailyReportToSupabase} onCancel={() => setCurrentPage('AdminDailyReports')} showAlert={showAlert} />;
            case 'AdminGallery': return <AdminGalleryPage dailyReports={dailyReports} children={children} staff={staff} loading={loadingData.dailyReports || loadingData.children || loadingData.staff} currentUser={currentUser} />;
            default: 
                if (!currentPage && session) { setCurrentPage('AssistantDashboard'); return null; }
                return <AssistantDashboardPage />;
        }

      case 'parent':
        switch (currentPage) {
            case 'ParentDashboard':
                return <ParentDashboardPage currentUser={currentUser} />;
            case 'ParentDailyReports': {
                const parentChildrenIds = Array.isArray(children) ? children.filter(c => c.primary_parent_id === currentUser?.profileId).map(c => c.id) : [];
                const filteredDailyReports = Array.isArray(dailyReports) ? dailyReports.filter(report => parentChildrenIds.includes(report.child_id)) : [];
                const relevantChildren = Array.isArray(children) ? children.filter(c => parentChildrenIds.includes(c.id)) : [];
                return <AdminDailyReportsPage 
                            dailyReports={filteredDailyReports} 
                            children={relevantChildren} 
                            staff={staff} 
                            loading={loadingData.dailyReports} 
                            onNavigateToCreateReport={null} 
                            onViewReportDetails={handleViewReportDetails} 
                       />;
            }
            case 'ParentInvoices': {
                const parentChildrenIdsForInvoices = (currentUser && currentUser.profileId && Array.isArray(children))
                    ? children.filter(c => c.primary_parent_id === currentUser.profileId).map(c => c.id)
                    : [];
                const filteredInvoices = Array.isArray(invoices) 
                    ? invoices.filter(inv => parentChildrenIdsForInvoices.includes(inv.child_id))
                    : [];
                const relevantChildrenForInvoices = (currentUser && currentUser.profileId && Array.isArray(children))
                    ? children.filter(c => parentChildrenIdsForInvoices.includes(c.id))
                    : [];
                return <AdminBillingPage 
                            invoices={filteredInvoices} 
                            children={relevantChildrenForInvoices} 
                            loading={loadingData.invoices} 
                            onNavigateToCreateInvoice={null} 
                            onViewInvoiceDetails={handleViewInvoiceDetails} 
                       />;
            }
            case 'AdminGallery': 
                return <AdminGalleryPage 
                            dailyReports={dailyReports} 
                            children={children} 
                            staff={staff} 
                            loading={loadingData.dailyReports || loadingData.children || loadingData.staff} 
                            currentUser={currentUser} 
                       />;
            case 'AdminAnnouncements':
                return <AdminAnnouncementsPage 
                            announcements={announcements} 
                            staff={staff} 
                            loading={loadingData.announcements} 
                            onNavigateToCreateAnnouncement={null} 
                            onEditAnnouncement={null} 
                            onDeleteAnnouncement={null} 
                       />;
            default:
                if (!currentPage && session) { setCurrentPage('ParentDashboard'); return null; }
                return <ParentDashboardPage currentUser={currentUser} />;
        }
      case 'unknown':
      case 'unknown_profile':
      case 'no_parent_profile':
      case 'exception_profile':
        return <UnknownRolePage />;
      default: 
        return <AuthPage onSignUp={handleSignUp} onSignIn={handleSignIn} loading={authActionLoading} />;
    }
  };

  // --- Main Return for App Component ---
  if (loadingAuth && !session && appMode === 'auth') { 
    return <div className="loading-screen"><Clock size={48} className="animate-spin-css" /> <span>Loading Daycare App...</span></div>;
  }

  return (
    <ErrorBoundary>
    <AppStateContext.Provider value={{
        currentUser, appMode, showAlert, 
        children, staff, rooms, dailyReports, incidentReports, medications, medicationLogs, 
        announcements, invoices, waitlistEntries, parentsList,
        setCurrentPage 
    }}>
      <div className={`app-container ${isSidebarOpen && session && appMode !== 'auth' && !['unknown', 'unknown_profile', 'no_parent_profile', 'exception_profile'].includes(appMode) ? 'sidebar-open' : 'sidebar-closed'}`}>
        {(!session || appMode === 'auth') ? ( 
            <AuthPage onSignUp={handleSignUp} onSignIn={handleSignIn} loading={authActionLoading} /> 
        ) : (
          <>
            {/* Sidebar enabled for admin, teacher, assistant, AND parent if they have nav items */}
            {(appMode !== 'auth' && !['unknown', 'unknown_profile', 'no_parent_profile', 'exception_profile'].includes(appMode) && currentNavItems.length > 0) && (
              <aside className="sidebar">
                <div className="sidebar-header"> {isSidebarOpen && <span className="sidebar-title">{currentPortalName}</span>} <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="sidebar-toggle-button"> {isSidebarOpen ? <X size={20} /> : <Menu size={20} />} </button> </div>
                <nav className="sidebar-nav"> {currentNavItems.map(item => ( <button key={item.name} onClick={() => {setCurrentPage(item.name); if(window.innerWidth <= 768 && isSidebarOpen) setIsSidebarOpen(false);}} className={`sidebar-nav-item ${currentPage === item.name ? 'active' : ''}`} title={item.label || item.name}> <item.icon size={isSidebarOpen ? 18 : 22} className="sidebar-nav-icon" /> {isSidebarOpen && <span className="sidebar-nav-label">{item.label || item.name}</span>} </button> ))} </nav>
                <div className="sidebar-footer"> {isSidebarOpen ? <button onClick={handleSignOut} className="btn btn-danger btn-full-width">Sign Out</button> : <button onClick={handleSignOut} className="sidebar-footer-icon-button" title="Sign Out"><LogOut size={20}/></button>} </div>
              </aside>
            )}
            <main className="main-content">
              <header className="main-header">
                 {/* Mobile menu button enabled for admin, teacher, assistant, AND parent if they have nav items */}
                {(appMode !== 'auth' && !['unknown', 'unknown_profile', 'no_parent_profile', 'exception_profile'].includes(appMode) && currentNavItems.length > 0) && (
                    <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="mobile-menu-button"> <Menu size={24} /> </button>
                )}
                <h1 className="page-title"> { currentNavItems.find(item => item.name === currentPage)?.label || currentPage.replace(/([A-Z])/g, ' $1').trim() || (appMode !== 'auth' && appMode.charAt(0).toUpperCase() + appMode.slice(1) + ' View') || "Daycare Management" } </h1>
                <div className="header-user-controls">
                    {session?.user && <div className="user-email">Logged in: <span>{currentUser?.name || session.user.email} ({currentUser?.role || 'N/A'})</span></div>}
                </div>
              </header>
              <div className="page-content-area"> {renderCurrentPage()} </div>
            </main>
          </>
        )}
        
        {/* Global Footer */}
        <footer className="app-footer" style={{ 
            textAlign: 'center', 
            padding: '15px 10px', 
            fontSize: '0.85em', 
            color: '#6c757d', 
            borderTop: '1px solid #dee2e6', 
            backgroundColor: '#f8f9fa',
            marginTop: 'auto' 
        }}>
          Evergreen Tots 2025 &copy; Evergreen Tots App
        </footer>

        {/* All Modals Rendered Here Conditionally */}
        {session && showEditChildModal && childToEdit && <EditChildModal child={childToEdit} parentsList={parentsList} showAlert={showAlert} rooms={rooms} onClose={() => { setShowEditChildModal(false); setChildToEdit(null); }} onUpdateChild={updateChildInSupabase} />}
        {session && showViewDailyReportModal && reportToView && 
            <ViewDailyReportModal 
              report={reportToView} 
              child={children.find(c => c.id === reportToView.child_id)} 
              staff={staff} 
              onClose={() => { setShowViewDailyReportModal(false); setReportToView(null); }} 
            />
        }
        {session && showViewIncidentModal && incidentToView && 
            <ViewIncidentDetailsModal 
                incident={incidentToView} 
                child={children.find(c => c.id === incidentToView.child_id)} 
                reportedByStaff={staff.find(s => s.id === incidentToView.reported_by_staff_id)} 
                onClose={() => { setShowViewIncidentModal(false); setIncidentToView(null); }} 
            />
        }
        {session && showAddMedicationModal && childForMedications && <AddMedicationModal childId={childForMedications.id} onClose={() => setShowAddMedicationModal(false)} onAddMedication={addMedicationToSupabase} showAlert={showAlert} />}
        {session && showEditMedicationModal && medicationToEdit && <EditMedicationModal medication={medicationToEdit} onClose={() => {setShowEditMedicationModal(false); setMedicationToEdit(null);}} onUpdateMedication={updateMedicationInSupabase} showAlert={showAlert} />}
        {session && showLogMedicationModal && medicationToLog && childForMedications && <LogMedicationAdministrationModal medicationToLog={medicationToLog} childId={childForMedications.id} onClose={() => {setShowLogMedicationModal(false); setMedicationToLog(null);}} onLogAdministration={addMedicationLogToSupabase} currentUser={currentUser} showAlert={showAlert} />}
        {session && showEditStaffModal && staffToEdit && <EditStaffModal staffMember={staffToEdit} rooms={rooms} onClose={() => { setShowEditStaffModal(false); setStaffToEdit(null); }} onUpdateStaff={updateStaffInSupabase} showAlert={showAlert} />}
        {session && showEditRoomModal && roomToEdit && <EditRoomModal room={roomToEdit} onClose={() => { setShowEditRoomModal(false); setRoomToEdit(null); }} onUpdateRoom={updateRoomInSupabase} showAlert={showAlert} />}
        {session && showViewInvoiceModal && invoiceToView && ( 
            <ViewInvoiceDetailsModal 
                invoice={invoiceToView} 
                child={children.find(c => c.id === invoiceToView.child_id)} 
                parentDetails={parentDetailsForInvoice} 
                onClose={() => { setShowViewInvoiceModal(false); setInvoiceToView(null); setParentDetailsForInvoice(null); }} 
            /> 
        )}
        {session && showEditParentModal && parentToEdit && ( 
            <EditParentModal 
                parent={parentToEdit} 
                onClose={() => { setShowEditParentModal(false); setParentToEdit(null);}} 
                onUpdateParent={updateParentInSupabase} 
                showAlert={showAlert} 
            /> 
        )}
      </div>
    </AppStateContext.Provider>
    </ErrorBoundary>
  );
};
export default App;
