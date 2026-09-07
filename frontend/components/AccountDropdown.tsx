export function AccountDropdown({ id, onSignedOut }: any) {
  return (
    <div id={id} style={{ position: 'absolute', right: 0, top: '48px', background: '#fff', color: '#000', padding: '10px' }}>
      Account Dropdown Stub
      <button onClick={onSignedOut}>Sign Out</button>
    </div>
  );
}
