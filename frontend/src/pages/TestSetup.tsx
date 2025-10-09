export default function TestSetup() {
  console.log('🧪 TestSetup component rendering...')
  console.log('🧪 TestSetup - About to return JSX')
  
  // Force a simple render first
  return (
    <div style={{ 
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'red',
      color: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '24px',
      zIndex: 9999
    }}>
      🧪 TEST SETUP PAGE IS WORKING!
    </div>
  );
}
