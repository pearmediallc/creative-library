import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { analyticsApi, facebookApi } from '../lib/api';
import { EditorPerformance, AdNameChange } from '../types';
import { formatNumber } from '../lib/utils';
import { TrendingUp, AlertTriangle, RefreshCw, DollarSign, Eye, MousePointer, Facebook, LogOut, CheckCircle, XCircle } from 'lucide-react';

// Facebook App ID from environment or fallback to existing app
const FACEBOOK_APP_ID = process.env.REACT_APP_FACEBOOK_APP_ID || '735375959485927';

// Declare FB type for TypeScript
declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

export function AnalyticsPage() {
  const [performance, setPerformance] = useState<EditorPerformance[]>([]);
  const [adsWithoutEditor, setAdsWithoutEditor] = useState<any[]>([]);
  const [adNameChanges, setAdNameChanges] = useState<AdNameChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  // Facebook connection state
  const [fbConnected, setFbConnected] = useState(false);
  const [fbAdAccount, setFbAdAccount] = useState<string | null>(null);
  const [fbAdAccountName, setFbAdAccountName] = useState<string | null>(null);
  const [fbAdAccounts, setFbAdAccounts] = useState<any[]>([]);
  const [fbLoading, setFbLoading] = useState(false);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState('');

  useEffect(() => {
    initializeFacebookSDK();
    checkFacebookStatus();
    fetchAnalytics();
  }, []);

  // Initialize Facebook SDK
  const initializeFacebookSDK = () => {
    console.log('🔷 Initializing Facebook SDK...');
    console.log('📱 Facebook App ID:', FACEBOOK_APP_ID);

    // Initialize FB SDK when loaded
    window.fbAsyncInit = function() {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });
      console.log('✅ Facebook SDK initialized with App ID:', FACEBOOK_APP_ID);
      console.log('✅ SDK Version: v18.0');
    };

    // Load Facebook SDK script if not already loaded
    if (!document.getElementById('facebook-jssdk')) {
      console.log('📥 Loading Facebook SDK script...');
      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ Facebook SDK script loaded successfully');
      };
      script.onerror = () => {
        console.error('❌ Failed to load Facebook SDK script');
      };
      document.body.appendChild(script);
    } else {
      console.log('ℹ️  Facebook SDK script already loaded');
    }
  };

  // Check if user has already connected Facebook
  const checkFacebookStatus = async () => {
    try {
      const response = await facebookApi.getStatus();
      if (response.data.success && response.data.data.connected) {
        setFbConnected(true);
        setFbAdAccount(response.data.data.adAccountId);
        setFbAdAccountName(response.data.data.adAccountName);
        console.log('✅ Facebook already connected:', response.data.data);
      }
    } catch (err) {
      console.log('No Facebook connection found');
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [perfRes, adsRes, changesRes] = await Promise.all([
        analyticsApi.getEditorPerformance(),
        analyticsApi.getAdsWithoutEditor(),
        analyticsApi.getAdNameChanges({ editor_changed: true }),
      ]);

      setPerformance(perfRes.data.data || []);
      setAdsWithoutEditor(adsRes.data.data || []);
      setAdNameChanges(changesRes.data.data || []);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      setError(err.response?.data?.error || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  // Handle Facebook login response (separate async function)
  const handleFBResponse = async (response: any) => {
    console.log('📡 Facebook login response received:', response);

    if (response.authResponse) {
      console.log('✅ Facebook login successful!');
      console.log('  - User ID:', response.authResponse.userID);
      console.log('  - Access Token (first 20 chars):', response.authResponse.accessToken.substring(0, 20) + '...');

      const accessToken = response.authResponse.accessToken;

      try {
        // Send access token to backend
        console.log('📤 Sending access token to backend...');
        await facebookApi.connect({ accessToken });
        console.log('✅ Access token stored in backend');

        // Fetch ad accounts
        console.log('📊 Fetching ad accounts...');
        const accountsRes = await facebookApi.getAdAccounts();
        const accounts = accountsRes.data.data || [];
        console.log('✅ Fetched ad accounts:', accounts.length);

        if (accounts.length > 0) {
          accounts.forEach((acc: any, idx: number) => {
            console.log(`  ${idx + 1}. ${acc.name} (${acc.id})`);
          });
        }

        setFbAdAccounts(accounts);
        setFbConnected(true);
        setShowAccountSelector(true);

        if (accounts.length === 1) {
          // Auto-select if only one account
          console.log('ℹ️  Auto-selecting single account');
          await handleSelectAdAccount(accounts[0]);
        }

        console.log('✅ ========== FACEBOOK LOGIN COMPLETE ==========\n');
      } catch (err: any) {
        console.error('\n❌ ========== FACEBOOK LOGIN FAILED ==========');
        console.error('Error:', err);
        console.error('Response:', err.response?.data);
        console.error('=============================================\n');
        setError(err.response?.data?.error || 'Failed to connect Facebook account');
      }
    } else {
      console.log('❌ Facebook login cancelled or failed');
      console.log('   Status:', response.status);
      setError('Facebook login was cancelled');
    }
    setFbLoading(false);
  };

  // Login with Facebook
  const handleFacebookLogin = () => {
    console.log('\n🔐 ========== FACEBOOK LOGIN START ==========');

    // Check if FB SDK is loaded
    if (typeof window.FB === 'undefined') {
      console.error('❌ Facebook SDK not loaded yet!');
      setError('Facebook SDK not loaded. Please refresh the page.');
      return;
    }

    console.log('✅ Facebook SDK is ready');
    console.log('📱 Using App ID:', FACEBOOK_APP_ID);

    setFbLoading(true);
    setError('');

    // Call FB.login with non-async callback
    window.FB.login(
      (response: any) => {
        // Call separate async function to handle response
        handleFBResponse(response);
      },
      {
        scope: 'ads_read,ads_management',
        auth_type: 'rerequest'
      }
    );
  };

  // Select ad account
  const handleSelectAdAccount = async (account: any) => {
    try {
      setFbLoading(true);
      await facebookApi.updateAdAccount({
        adAccountId: account.id,
        adAccountName: account.name
      });

      setFbAdAccount(account.id);
      setFbAdAccountName(account.name);
      setShowAccountSelector(false);
      console.log('✅ Ad account selected:', account);
    } catch (err: any) {
      console.error('❌ Failed to update ad account:', err);
      setError(err.response?.data?.error || 'Failed to select ad account');
    } finally {
      setFbLoading(false);
    }
  };

  // Disconnect Facebook
  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect your Facebook account?')) {
      return;
    }

    try {
      setFbLoading(true);
      await facebookApi.disconnect();
      setFbConnected(false);
      setFbAdAccount(null);
      setFbAdAccountName(null);
      setFbAdAccounts([]);
      console.log('✅ Facebook disconnected');
    } catch (err: any) {
      console.error('❌ Failed to disconnect:', err);
      setError(err.response?.data?.error || 'Failed to disconnect Facebook');
    } finally {
      setFbLoading(false);
    }
  };

  // Sync ads from Facebook
  const handleSync = async () => {
    if (!fbAdAccount) {
      setError('Please connect Facebook and select an ad account first');
      return;
    }

    setSyncing(true);
    setError('');

    try {
      const response = await analyticsApi.sync(fbAdAccount);
      await fetchAnalytics();

      const { totalAdsProcessed, adsWithEditor, adsWithoutEditor: adsNoEditor } = response.data.data;
      alert(
        `✅ Sync Complete!\n\n` +
        `Total Ads: ${totalAdsProcessed}\n` +
        `With Editor: ${adsWithEditor}\n` +
        `Without Editor: ${adsNoEditor}`
      );
    } catch (err: any) {
      console.error('❌ Sync failed:', err);
      setError(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </DashboardLayout>
    );
  }

  const totalSpend = performance.reduce((sum, p) => sum + (p.total_spend || 0), 0);
  const totalImpressions = performance.reduce((sum, p) => sum + (p.total_impressions || 0), 0);
  const totalClicks = performance.reduce((sum, p) => sum + (p.total_clicks || 0), 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">Facebook ad performance by editor</p>
          </div>
          <Button onClick={fetchAnalytics} variant="outline">
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        </div>

        {/* Facebook Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Facebook size={20} />
              Facebook Connection
            </CardTitle>
            <CardDescription>
              Connect your Facebook account to sync ad data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Connection Status */}
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  {fbConnected ? (
                    <>
                      <CheckCircle className="text-green-500" size={24} />
                      <div>
                        <p className="font-medium">Connected</p>
                        {fbAdAccountName && (
                          <p className="text-sm text-muted-foreground">
                            Ad Account: {fbAdAccountName}
                          </p>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="text-muted-foreground" size={24} />
                      <div>
                        <p className="font-medium">Not Connected</p>
                        <p className="text-sm text-muted-foreground">
                          Connect to sync your Facebook ads
                        </p>
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-2">
                  {fbConnected ? (
                    <>
                      <Button
                        onClick={() => {
                          setShowAccountSelector(!showAccountSelector);
                          if (!showAccountSelector && fbAdAccounts.length === 0) {
                            facebookApi.getAdAccounts().then(res => {
                              setFbAdAccounts(res.data.data || []);
                            });
                          }
                        }}
                        variant="outline"
                        size="sm"
                      >
                        Change Account
                      </Button>
                      <Button
                        onClick={handleDisconnect}
                        variant="outline"
                        size="sm"
                        disabled={fbLoading}
                      >
                        <LogOut size={16} className="mr-2" />
                        Disconnect
                      </Button>
                    </>
                  ) : (
                    <Button
                      onClick={handleFacebookLogin}
                      disabled={fbLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Facebook size={16} className="mr-2" />
                      {fbLoading ? 'Connecting...' : 'Connect Facebook'}
                    </Button>
                  )}
                </div>
              </div>

              {/* Ad Account Selector */}
              {showAccountSelector && fbAdAccounts.length > 0 && (
                <div className="border rounded-lg p-4">
                  <p className="font-medium mb-3">Select Ad Account:</p>

                  {/* Search Input */}
                  <input
                    type="text"
                    placeholder="Search ad accounts..."
                    value={accountSearchQuery}
                    onChange={(e) => setAccountSearchQuery(e.target.value)}
                    className="w-full p-2 mb-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  />

                  {/* Account List */}
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {fbAdAccounts
                      .filter((account) =>
                        account.name.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                        account.id.toLowerCase().includes(accountSearchQuery.toLowerCase())
                      )
                      .map((account) => (
                        <button
                          key={account.id}
                          onClick={() => handleSelectAdAccount(account)}
                          className={`w-full text-left p-3 rounded border hover:bg-muted transition ${
                            fbAdAccount === account.id ? 'border-primary bg-muted' : ''
                          }`}
                          disabled={fbLoading}
                        >
                          <p className="font-medium">{account.name}</p>
                          <p className="text-sm text-muted-foreground">{account.id}</p>
                        </button>
                      ))}

                    {/* No results message */}
                    {fbAdAccounts.filter((account) =>
                      account.name.toLowerCase().includes(accountSearchQuery.toLowerCase()) ||
                      account.id.toLowerCase().includes(accountSearchQuery.toLowerCase())
                    ).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No ad accounts found matching "{accountSearchQuery}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Sync Button */}
              {fbConnected && fbAdAccount && (
                <Button
                  onClick={handleSync}
                  disabled={syncing}
                  className="w-full"
                >
                  <RefreshCw size={16} className="mr-2" />
                  {syncing ? 'Syncing Ads...' : 'Sync Facebook Ads'}
                </Button>
              )}

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overview Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Spend</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <DollarSign size={24} />
                ${formatNumber(Math.round(totalSpend))}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Impressions</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <Eye size={24} />
                {formatNumber(totalImpressions)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Clicks</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <MousePointer size={24} />
                {formatNumber(totalClicks)}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg CTR</CardDescription>
              <CardTitle className="text-3xl flex items-center gap-2">
                <TrendingUp size={24} />
                {avgCTR.toFixed(2)}%
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Editor Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Editor Performance</CardTitle>
            <CardDescription>Ad performance breakdown by creative editor</CardDescription>
          </CardHeader>
          <CardContent>
            {performance.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-7 gap-4 pb-2 border-b font-medium text-sm">
                  <div>Editor</div>
                  <div className="text-right">Ads</div>
                  <div className="text-right">Spend</div>
                  <div className="text-right">Impressions</div>
                  <div className="text-right">Clicks</div>
                  <div className="text-right">CPM</div>
                  <div className="text-right">CPC</div>
                </div>
                {performance.map((editor) => (
                  <div key={editor.editor_id} className="grid grid-cols-7 gap-4 text-sm">
                    <div className="font-medium">{editor.editor_name}</div>
                    <div className="text-right text-muted-foreground">{formatNumber(editor.ad_count)}</div>
                    <div className="text-right">${formatNumber(Math.round(editor.total_spend || 0))}</div>
                    <div className="text-right">{formatNumber(editor.total_impressions || 0)}</div>
                    <div className="text-right">{formatNumber(editor.total_clicks || 0)}</div>
                    <div className="text-right">${(editor.avg_cpm || 0).toFixed(2)}</div>
                    <div className="text-right">${(editor.avg_cpc || 0).toFixed(2)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground mb-4">
                  No performance data available yet.
                </p>
                {fbConnected && fbAdAccount ? (
                  <p className="text-sm text-muted-foreground">
                    Click "Sync Facebook Ads" above to import your ad data.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Connect your Facebook account to get started.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ads Without Editor */}
        {adsWithoutEditor.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-destructive" />
                Ads Without Editor Assignment
              </CardTitle>
              <CardDescription>
                These ads don't have a recognized editor name in the ad name
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {adsWithoutEditor.slice(0, 10).map((ad) => (
                  <div key={ad.fb_ad_id} className="flex items-center justify-between py-2 border-b">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{ad.ad_name}</p>
                      <p className="text-xs text-muted-foreground">{ad.campaign_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">${Math.round(ad.spend || 0)}</p>
                      <p className="text-xs text-muted-foreground">CPM: ${(ad.cpm || 0).toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Ad Name Changes */}
        {adNameChanges.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-destructive" />
                Editor Name Changes
              </CardTitle>
              <CardDescription>
                Ads where the editor name was changed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {adNameChanges.slice(0, 10).map((change) => (
                  <div key={change.id} className="p-3 bg-muted rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{change.current_ad_name || change.new_ad_name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{change.campaign_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(change.detected_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-destructive">{change.old_editor_name || 'None'}</span>
                      <span>→</span>
                      <span className="text-primary">{change.new_editor_name || 'None'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
