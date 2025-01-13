import { SignUp } from '@clerk/nextjs';

export default function Page() {
  return (
    <div
      style={{
        background: '#f5f5f5',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <SignUp
        appearance={{
          elements: {
            rootBox: {
              boxShadow: 'none', 
              borderRadius: '8px',
              padding: '20px',
              width: '400px',
            },
            headerTitle: {
              color: '#333',
              fontSize: '24px',
              fontWeight: 'bold',
              marginBottom: '10px',
            },
            formFieldInput: {
              borderColor: '#ddd',
              borderRadius: '4px',
              boxShadow: 'none', 
            },
            formButtonPrimary: {
              backgroundColor: '#4caf50',
              color: '#fff',
              boxShadow: 'none', 
            },
            footer: {
              display: 'none', 
            },
            badge: {
              display: 'none', 
            },
          },
        }}
      />
    </div>
  );
}
