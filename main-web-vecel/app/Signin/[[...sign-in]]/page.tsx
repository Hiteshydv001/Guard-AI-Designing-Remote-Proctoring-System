import { SignIn } from '@clerk/nextjs';

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
      <SignIn
        appearance={{
          elements: {
            rootBox: {
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
            },
            formButtonPrimary: {
              backgroundColor: '#4caf50',
              color: '#fff',
            },
            footer: {
              display: 'none', // Hides "Secured by"
            },
            badge: {
              display: 'none', // Hides "Development mode"
            },
          },
        }}
      />
    </div>
  );
}
