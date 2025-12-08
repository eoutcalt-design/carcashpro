import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User, Deal } from '../types';
import { Users, Database, Settings, Clock, TrendingUp, DollarSign } from 'lucide-react';

interface AdminStats {
  totalUsers: number;
  proUsers: number;
  freeUsers: number;
  totalDeals: number;
  totalRevenue: number;
}

interface UserWithStats extends User {
  dealCount: number;
  totalCommission: number;
}

export const AdminConsole: React.FC = () => {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    proUsers: 0,
    freeUsers: 0,
    totalDeals: 0,
    totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'stats' | 'config'>('users');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      
      // Get all users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: UserWithStats[] = [];
      let proCount = 0;
      let totalDealsCount = 0;
      let totalRev = 0;

      for (const userDoc of usersSnapshot.docs) {
        const userData = userDoc.data() as User;
        
        // Get user's deals
        const dealsSnapshot = await getDocs(collection(db, `users/${userDoc.id}/deals`));
        const dealCount = dealsSnapshot.size;
        
        // Calculate total commission for this user
        let userCommission = 0;
        dealsSnapshot.forEach(dealDoc => {
          const deal = dealDoc.data() as Deal;
          userCommission += deal.commission || 0;
        });

        usersData.push({
          ...userData,
          id: userDoc.id,
          dealCount,
          totalCommission: userCommission
        });

        if (userData.isPro) proCount++;
        totalDealsCount += dealCount;
        if (userData.isPro) totalRev += 9.99; // $9.99 per Pro user
      }

      // Sort users by last login (most recent first)
      usersData.sort((a, b) => {
        const aTime = a.lastLogin ? new Date(a.lastLogin).getTime() : 0;
        const bTime = b.lastLogin ? new Date(b.lastLogin).getTime() : 0;
        return bTime - aTime;
      });

      setUsers(usersData);
      setStats({
        totalUsers: usersData.length,
        proUsers: proCount,
        freeUsers: usersData.length - proCount,
        totalDeals: totalDealsCount,
        totalRevenue: totalRev
      });
      
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(isoString);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading admin data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-white/10">
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="inline mr-2" size={18} />
          Users
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'stats'
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Database className="inline mr-2" size={18} />
          Stats
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'config'
              ? 'text-primary border-b-2 border-primary'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="inline mr-2" size={18} />
          Config
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">All Users ({users.length})</h3>
            <button
              onClick={loadAdminData}
              className="px-3 py-1 text-sm bg-primary/20 hover:bg-primary/30 rounded-lg transition-colors"
            >
              Refresh
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Deals</th>
                  <th className="px-4 py-3 text-right">Commission</th>
                  <th className="px-4 py-3 text-left">Last Login</th>
                  <th className="px-4 py-3 text-left">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">{user.email}</td>
                    <td className="px-4 py-3">
                      {user.firstName || user.lastName
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {user.isPro ? (
                        <span className="px-2 py-1 bg-accent/20 text-accent rounded text-xs font-semibold">
                          PRO
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                          Free
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">{user.dealCount}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      ${user.totalCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-slate-300">{formatRelativeTime(user.lastLogin)}</span>
                        <span className="text-xs text-slate-500">{formatDate(user.lastLogin)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="text-primary" size={24} />
              <h4 className="text-slate-400 text-sm">Total Users</h4>
            </div>
            <p className="text-3xl font-bold">{stats.totalUsers}</p>
          </div>

          <div className="bg-slate-800/50 border border-accent/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="text-accent" size={24} />
              <h4 className="text-slate-400 text-sm">Pro Users</h4>
            </div>
            <p className="text-3xl font-bold text-accent">{stats.proUsers}</p>
            <p className="text-xs text-slate-500 mt-1">
              {stats.totalUsers > 0 ? ((stats.proUsers / stats.totalUsers) * 100).toFixed(1) : 0}% conversion
            </p>
          </div>

          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="text-slate-400" size={24} />
              <h4 className="text-slate-400 text-sm">Free Users</h4>
            </div>
            <p className="text-3xl font-bold">{stats.freeUsers}</p>
          </div>

          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Database className="text-primary" size={24} />
              <h4 className="text-slate-400 text-sm">Total Deals</h4>
            </div>
            <p className="text-3xl font-bold">{stats.totalDeals}</p>
            <p className="text-xs text-slate-500 mt-1">
              Avg: {stats.totalUsers > 0 ? (stats.totalDeals / stats.totalUsers).toFixed(1) : 0} per user
            </p>
          </div>

          <div className="bg-slate-800/50 border border-accent/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="text-accent" size={24} />
              <h4 className="text-slate-400 text-sm">MRR (Monthly Recurring Revenue)</h4>
            </div>
            <p className="text-3xl font-bold text-accent">${stats.totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-slate-500 mt-1">
              ARR: ${(stats.totalRevenue * 12).toFixed(2)}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="text-primary" size={24} />
              <h4 className="text-slate-400 text-sm">Active Today</h4>
            </div>
            <p className="text-3xl font-bold">
              {users.filter(u => {
                if (!u.lastLogin) return false;
                const diffHours = (new Date().getTime() - new Date(u.lastLogin).getTime()) / (1000 * 60 * 60);
                return diffHours < 24;
              }).length}
            </p>
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-6">
            <h4 className="font-semibold mb-4">System Configuration</h4>
            <div className="space-y-3 text-sm font-mono">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Firebase Project:</span>
                <span className="text-primary">carcashpro</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Google Analytics:</span>
                <span className="text-accent">G-6NLZQXKGQ6</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Facebook Pixel:</span>
                <span className="text-accent">2896469093887257</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Stripe Webhook:</span>
                <span className="text-accent">Active</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Free Trial Limit:</span>
                <span>10 deals</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Pro Price:</span>
                <span className="text-accent">$9.99/month</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Environment:</span>
                <span className="text-accent">Production</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/50 border border-rose-500/20 rounded-xl p-6">
            <h4 className="font-semibold mb-2 text-rose-400">Admin Emails</h4>
            <p className="text-sm text-slate-400 mb-3">Users with admin console access:</p>
            <div className="space-y-2">
              <div className="px-3 py-2 bg-black/40 rounded font-mono text-xs">info@carcashpro.com</div>
              <div className="px-3 py-2 bg-black/40 rounded font-mono text-xs">eoutcalt@gmail.com</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
