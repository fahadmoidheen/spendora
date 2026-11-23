// The app's section switcher: Transactions, Analysis, Categories, To-dos.
//
// Drawn twice by App with the same buttons: "page-tabs" sits in the page
// header on larger screens (styled like the segmented control), and
// "bottom-nav" is the phone's bottom bar. CSS shows one or the other. The
// current section is marked with aria-current for screen readers. A tab
// can carry a count (`badge`), e.g. to-dos due today.
export default function ViewTabs({ tabs, value, onChange, className }) {
  return (
    <nav className={`view-tabs ${className}`} aria-label="Sections">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          className={`view-tab${tab.value === value ? ' is-active' : ''}`}
          aria-current={tab.value === value ? 'page' : undefined}
          onClick={() => onChange(tab.value)}
        >
          <span className="view-tab-icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
          {tab.badge > 0 && (
            <span className="view-tab-badge">
              {tab.badge > 9 ? '9+' : tab.badge}
              <span className="visually-hidden"> due</span>
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
