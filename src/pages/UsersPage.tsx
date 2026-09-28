import React from 'react';
import { UserDirectory } from '../components/users/UserDirectory';

export const UsersPage: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full w-full overflow-hidden">
      <UserDirectory />
    </div>
  );
};

