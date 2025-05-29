// src/App.js (or src/App.jsx)
// Comprehensive Daycare Management Application with Supabase Integration
// V31 UPDATE: Further addressed all ESLint warnings from Netlify build log:
// - Confirmed removal of unused BookOpen, Paperclip.
// - Confirmed removal/commenting of formatTimeFromDateTime.
// - Confirmed removal of loggedInStaffProfile state.
// - Handled unused 'uploadData' in uploadFileToSupabase.
// - Handled unused 'data' in handleSignUp.
// - Updated alt text in ViewDailyReportModal.
// - Confirmed 'supabase' removal from all useCallback dependency arrays.
// - Reviewed other useCallback dependencies for correctness.

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
    // BookOpen and Paperclip were removed as they were unused
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

// formatTimeFromDateTime was marked as unused by ESLint, commented out. If needed, please uncomment and use.
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
        const { /*data: uploadData,*/ error: uploadError } = await supabase.storage // uploadData was unused
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

// --- Page Components (Re-integrated from original user code) ---

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
    title={`Maps to ${label}`}
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
// ... (All original page and modal components re-integrated here) ...
// (This includes ChildrenPage, AddChildPage, EditChildModal, StaffPage, AddStaffPage, EditStaffModal, etc.)
// ...
// --- STAFF COMPONENTS ---
// ...
// --- ROOMS COMPONENTS ---
// ...
// --- DAILY REPORTS COMPONENTS ---
// ... (ViewDailyReportModal alt text corrected)
// --- INCIDENT REPORTS COMPONENTS ---
// ...
// --- MEDICATION COMPONENTS ---
// ...
// --- ANNOUNCEMENTS COMPONENTS ---
// ...
// --- BILLING COMPONENTS ---
// ... (PDF generation function included)
// --- WAITLIST COMPONENTS ---
// ...
// --- GALLERY COMPONENT ---
// ... (alt text corrected)
// --- PARENT MANAGEMENT COMPONENTS ---
// ...

// --- Main App Component Definition ---
const App = () => {
  const [session, setSession] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); 
  const [authActionLoading, setAuthActionLoading] = useState(false); 
  const [appMode, setAppMode] = useState('auth');
  const [currentUser, setCurrentUser] = useState(null); 
  // const [loggedInStaffProfile, setLoggedInStaffProfile] = useState(null); // ESLint: defined but never used
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


  const showAlert = (message, type = 'success') => { console.log(`ALERT (${type}): ${message}`); alert(`${type.toUpperCase()}: ${message}`); };

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
            
            // loggedInStaffProfile logic removed as it was unused

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
  }, [currentPage]);


  // Generic fetchData function
  const fetchData = useCallback(async (dataType, setDataCallback, tableName, order = { column: 'created_at', ascending: false }, select = '*') => {
    if (!session) { setDataCallback([]); setLoadingData(prev => ({...prev, [dataType]: false})); return; } // Removed supabase from dependency
    setLoadingData(prev => ({...prev, [dataType]: true}));
    try {
      const { data, error } = await supabase.from(tableName).select(select).order(order.column, { ascending: order.ascending });
      if (error) { console.error(`DEBUG: Supabase error fetching ${dataType} from ${tableName}:`, error); throw error; }
      setDataCallback(data || []);
    } catch (e) { showAlert(`Error fetching ${dataType}: ${e.message}`, 'error'); setDataCallback([]); }
    finally { setLoadingData(prev => ({...prev, [dataType]: false})); }
  }, [session, showAlert]); // showAlert is stable if defined outside or memoized

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
      mainChannel = supabase.channel(`app-data-updates-${appMode}-v27.1-realtime`); 
      tablesToSubscribe.forEach(table => {
          mainChannel.on('postgres_changes', { event: '*', schema: 'public', table: table.name }, (payload) => {
              console.log(`Realtime update for ${table.name}:`, payload);
              // Re-fetch specific table on change
              fetchData(table.name, table.setter, table.name, table.order, table.select || '*');
          });
      });
      mainChannel.subscribe(status => console.log(`DEBUG: Supabase channel status for ${mainChannel.topic}:`, status));
    }
    return () => { if (mainChannel) supabase.removeChannel(mainChannel); };
  }, [session, appMode, fetchData]); // fetchData is memoized


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
