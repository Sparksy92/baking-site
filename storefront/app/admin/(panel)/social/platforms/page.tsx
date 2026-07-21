'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { addToast } from '@/lib/toast';
import {
  CheckCircle, XCircle, Clock, AlertCircle, ChevronDown, ChevronUp, ExternalLink, RefreshCw, Send, Unplug,
} from 'lucide-react';

type PlatformStrategy = {
  posts_per_day: number;
  best_times: string[];
  content_mix: Record<string, number>;
  enabled: boolean;
};

type Platform = {
  id: number;
  platform: string;
  display_name: string;
  enabled: boolean;
  prompt_template: string;
  hashtag_mode: 'auto' | 'manual' | 'none';
  brand_hashtag: string | null;
  banned_hashtags: string | null;
  max_hashtags: number;
  max_caption_chars: number;
  max_images_per_post: number;
  auto_publish: boolean;
  account_id: string | null;
  setup_status: 'not_configured' | 'pending_review' | 'active' | 'error';
  setup_notes: string | null;
};

type FacebookConnection = {
  id: number;
  provider: string;
  account_type: string;
  display_name: string | null;
  external_account_id: string;
  external_user_id: string | null;
  scopes: string[];
  status: 'connected' | 'expired' | 'revoked' | 'error' | 'disconnected' | 'pending_review';
  last_error: string | null;
  last_checked_at: string | null;
  last_synced_at: string | null;
  connected_by_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type FacebookStatus = {
  configured: boolean;
  connection: FacebookConnection | null;
};

type FacebookPage = {
  page_id: string;
  name: string;
  category: string | null;
  connected: boolean;
  connection_status: string | null;
};

type InstagramConnection = FacebookConnection & {
  metadata: {
    instagram_username?: string;
    instagram_account_name?: string;
    instagram_profile_picture_url?: string;
    linked_facebook_page_id?: string;
    linked_facebook_page_name?: string;
    media_count?: number;
    account_type?: string;
  };
};

type InstagramStatus = {
  configured: boolean;
  connection: InstagramConnection | null;
};

type InstagramAccount = {
  ig_user_id: string;
  username: string;
  name: string | null;
  profile_picture_url: string | null;
  linked_facebook_page_id: string | null;
  linked_facebook_page_name: string | null;
  connected: boolean;
  connection_status: string | null;
};

type LinkedInConnection = FacebookConnection & {
  metadata: {
    organization_urn?: string;
    organization_id?: string;
    vanity_name?: string;
    localized_name?: string;
    website_url?: string;
    logo_url?: string;
    connection_owner_name?: string;
    connection_owner_email?: string;
    linkedin_app_product_status?: string;
    approval_note?: string | null;
  };
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
};

type LinkedInStatus = {
  configured: boolean;
  connection: LinkedInConnection | null;
};

type LinkedInOrganization = {
  organization_urn: string;
  organization_id: string | null;
  name: string;
  vanity_name: string | null;
  website_url: string | null;
  connected: boolean;
  connection_status: string | null;
};

type TikTokConnection = FacebookConnection & {
  metadata: {
    open_id?: string;
    union_id?: string;
    avatar_url?: string;
    display_name?: string;
    username?: string;
    profile_deep_link?: string;
    profile_web_link?: string;
    is_verified?: boolean;
    direct_post_enabled?: boolean;
    upload_to_inbox_enabled?: boolean;
    app_review_status_note?: string | null;
  };
  token_expires_at: string | null;
  refresh_token_expires_at: string | null;
};

type TikTokStatus = {
  configured: boolean;
  direct_post_feature_enabled: boolean;
  connection: TikTokConnection | null;
};

type XConnection = Omit<FacebookConnection, 'status'> & {
  status: FacebookConnection['status'] | 'pending_api_access';
  metadata: {
    username?: string;
    name?: string;
    profile_image_url?: string;
    verified?: boolean;
    verified_type?: string;
    protected?: boolean;
    description?: string;
    x_api_access_note?: string;
    media_posts_enabled?: boolean;
  };
  token_expires_at: string | null;
};

type XStatus = {
  configured: boolean;
  media_posts_enabled: boolean;
  required_scopes: string[];
  connection: XConnection | null;
};

type YouTubeStatus = {
  configured: boolean;
  connection: { status: string; display_name: string; last_error: string | null; metadata?: { channel_title?: string; channel_id?: string; subscriber_count?: string; custom_url?: string } } | null;
};

type PinterestStatus = {
  configured: boolean;
  connection: { status: string; display_name: string; last_error: string | null; metadata?: { username?: string; display_name?: string; default_board_name?: string } } | null;
};

type ThreadsStatus = {
  configured: boolean;
  connection: { status: string; display_name: string; last_error: string | null; metadata?: { username?: string; display_name?: string; biography?: string } } | null;
};

const HASHTAG_MODE_LABELS: Record<string, string> = {
  auto:   'AI-Suggested (recommended)',
  manual: 'Manual Only',
  none:   'Disabled — no hashtags',
};

type SaveState = Record<string, boolean>;

const STATUS_META: Record<Platform['setup_status'], { label: string; icon: React.ElementType; color: string }> = {
  active:          { label: 'Active',           icon: CheckCircle,  color: 'text-green-600' },
  pending_review:  { label: 'Pending Review',   icon: Clock,        color: 'text-yellow-600' },
  not_configured:  { label: 'Not Configured',   icon: XCircle,      color: 'text-gray-500' },
  error:           { label: 'Error',            icon: AlertCircle,  color: 'text-red-500' },
};

const PLATFORM_LINKS: Record<string, string> = {
  facebook:  'https://developers.facebook.com',
  instagram: 'https://developers.facebook.com',
  x:         'https://developer.twitter.com',
  linkedin:  'https://developer.linkedin.com',
  tiktok:    'https://developers.tiktok.com',
  youtube:   'https://console.cloud.google.com',
  threads:   'https://developers.facebook.com/docs/threads',
};

const PLATFORM_ICONS: Record<string, string> = {
  facebook:  '𝕗',
  instagram: '◉',
  x:         '𝕏',
  linkedin:  'in',
  tiktok:    '♪',
  youtube:   '▶',
  pinterest: '📌',
  threads:   '🧵',
};

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [strategy, setStrategy] = useState<Record<string, PlatformStrategy>>({});
  const [storeTimezone, setStoreTimezone] = useState('America/Toronto');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<SaveState>({});
  const [loading, setLoading] = useState(true);
  const [facebookStatus, setFacebookStatus] = useState<FacebookStatus | null>(null);
  const [facebookPages, setFacebookPages] = useState<FacebookPage[]>([]);
  const [facebookBusy, setFacebookBusy] = useState<string | null>(null);
  const [facebookError, setFacebookError] = useState<string | null>(null);
  const [instagramStatus, setInstagramStatus] = useState<InstagramStatus | null>(null);
  const [instagramAccounts, setInstagramAccounts] = useState<InstagramAccount[]>([]);
  const [instagramBusy, setInstagramBusy] = useState<string | null>(null);
  const [instagramError, setInstagramError] = useState<string | null>(null);
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus | null>(null);
  const [linkedinOrganizations, setLinkedinOrganizations] = useState<LinkedInOrganization[]>([]);
  const [linkedinBusy, setLinkedinBusy] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [tiktokStatus, setTiktokStatus] = useState<TikTokStatus | null>(null);
  const [tiktokBusy, setTiktokBusy] = useState<string | null>(null);
  const [tiktokError, setTiktokError] = useState<string | null>(null);
  const [xStatus, setXStatus] = useState<XStatus | null>(null);
  const [xBusy, setXBusy] = useState<string | null>(null);
  const [xError, setXError] = useState<string | null>(null);
  const [youtubeStatus, setYoutubeStatus] = useState<YouTubeStatus | null>(null);
  const [youtubeBusy, setYoutubeBusy] = useState<string | null>(null);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [pinterestStatus, setPinterestStatus] = useState<PinterestStatus | null>(null);
  const [pinterestBusy, setPinterestBusy] = useState<string | null>(null);
  const [pinterestError, setPinterestError] = useState<string | null>(null);
  const [threadsStatus, setThreadsStatus] = useState<ThreadsStatus | null>(null);
  const [threadsBusy, setThreadsBusy] = useState<string | null>(null);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<Platform[]>('/api/admin/social/platforms'),
      api.get<FacebookStatus>('/api/social/facebook/status').catch(() => null),
      api.get<InstagramStatus>('/api/social/instagram/status').catch(() => null),
      api.get<LinkedInStatus>('/api/social/linkedin/status').catch(() => null),
      api.get<TikTokStatus>('/api/social/tiktok/status').catch(() => null),
      api.get<XStatus>('/api/social/x/status').catch(() => null),
      api.get<YouTubeStatus>('/api/social/youtube/status').catch(() => null),
      api.get<PinterestStatus>('/api/social/pinterest/status').catch(() => null),
      api.get<ThreadsStatus>('/api/social/threads/status').catch(() => null),
      api.get<Record<string, PlatformStrategy>>('/api/admin/social/strategy').catch(() => ({})),
      api.get<{key:string;value:string}[]>('/api/admin/settings').catch(() => [] as {key:string;value:string}[]),
    ])
      .then(([platformRows, fbStatus, igStatus, liStatus, ttStatus, xStatus, ytStatus, ptStatus, thStatus, strategyData, allSettings]) => {
        setPlatforms(platformRows);
        setFacebookStatus(fbStatus);
        setInstagramStatus(igStatus);
        setLinkedinStatus(liStatus);
        setTiktokStatus(ttStatus);
        setXStatus(xStatus);
        setYoutubeStatus(ytStatus);
        setPinterestStatus(ptStatus);
        setThreadsStatus(thStatus);
        const raw = (strategyData as any)?.platforms ?? strategyData ?? {};
        setStrategy(raw);
        const tz = (allSettings as {key:string;value:string}[]).find(s => s.key === 'store_timezone');
        if (tz?.value) setStoreTimezone(tz.value);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fbError = params.get('facebook_error');
    if (fbError) {
      setFacebookError(fbError);
      setExpanded((prev) => ({ ...prev, facebook: true }));
    }
    if (params.get('facebook_oauth') === 'pages') {
      setExpanded((prev) => ({ ...prev, facebook: true }));
      loadFacebookPages();
    }
    const igError = params.get('instagram_error');
    if (igError) {
      setInstagramError(igError);
      setExpanded((prev) => ({ ...prev, instagram: true }));
    }
    if (params.get('instagram_oauth') === 'accounts') {
      setExpanded((prev) => ({ ...prev, instagram: true }));
      loadInstagramAccounts();
    }
    const liError = params.get('linkedin_error');
    if (liError) {
      setLinkedinError(liError);
      setExpanded((prev) => ({ ...prev, linkedin: true }));
    }
    if (params.get('linkedin_oauth') === 'organizations') {
      setExpanded((prev) => ({ ...prev, linkedin: true }));
      loadLinkedInOrganizations();
    }
    const ttError = params.get('tiktok_error');
    if (ttError) {
      setTiktokError(ttError);
      setExpanded((prev) => ({ ...prev, tiktok: true }));
    }
    if (params.get('tiktok_oauth') === 'connected') {
      setExpanded((prev) => ({ ...prev, tiktok: true }));
      loadTikTokStatus();
    }
    const xError = params.get('x_error');
    if (xError) {
      setXError(xError);
      setExpanded((prev) => ({ ...prev, x: true }));
    }
    if (params.get('x_oauth') === 'connected') {
      setExpanded((prev) => ({ ...prev, x: true }));
      loadXStatus();
    }
    const ptError = params.get('pinterest_error');
    if (ptError) {
      setPinterestError(ptError);
      setExpanded((prev) => ({ ...prev, pinterest: true }));
    }
    if (params.get('pinterest_connected') === '1') {
      setExpanded((prev) => ({ ...prev, pinterest: true }));
      loadPinterestStatus();
    }
    const thError = params.get('threads_error');
    if (thError) {
      setThreadsError(thError);
      setExpanded((prev) => ({ ...prev, threads: true }));
    }
    if (params.get('threads_connected') === '1') {
      setExpanded((prev) => ({ ...prev, threads: true }));
      loadThreadsStatus();
    }
    const ytError = params.get('youtube_error');
    if (ytError) {
      setYoutubeError(ytError);
      setExpanded((prev) => ({ ...prev, youtube: true }));
    }
    if (params.get('youtube_connected') === '1') {
      setExpanded((prev) => ({ ...prev, youtube: true }));
      loadYoutubeStatus();
    }
  }, []);

  function toggle(platform: string) {
    setExpanded((prev) => ({ ...prev, [platform]: !prev[platform] }));
  }

  function update(platform: string, field: keyof Platform, value: unknown) {
    setPlatforms((prev) =>
      prev.map((p) => (p.platform === platform ? { ...p, [field]: value } : p))
    );
  }

  function updateStrategy(platform: string, field: keyof PlatformStrategy, value: unknown) {
    setStrategy((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], [field]: value },
    }));
  }

  async function save(p: Platform) {
    setSaving((prev) => ({ ...prev, [p.platform]: true }));
    try {
      const stratCfg = strategy[p.platform];
      await Promise.all([
        api.patch(`/api/admin/social/platforms/${p.platform}`, {
          enabled: p.enabled,
          prompt_template: p.prompt_template,
          hashtag_mode: p.hashtag_mode,
          brand_hashtag: p.brand_hashtag,
          banned_hashtags: p.banned_hashtags,
          max_hashtags: p.max_hashtags,
          max_images_per_post: p.max_images_per_post,
          auto_publish: p.auto_publish,
          account_id: p.account_id,
        }),
        stratCfg
          ? api.put('/api/admin/social/strategy', {
              [p.platform]: { ...stratCfg, enabled: p.enabled },
            })
          : Promise.resolve(),
      ]);
      addToast(`${p.display_name} saved`, 'success');
    } catch {
      addToast(`Failed to save ${p.display_name}`, 'error');
    } finally {
      setSaving((prev) => ({ ...prev, [p.platform]: false }));
    }
  }

  async function loadFacebookStatus() {
    const status = await api.get<FacebookStatus>('/api/social/facebook/status');
    setFacebookStatus(status);
  }

  async function loadFacebookPages() {
    setFacebookBusy('pages');
    try {
      const data = await api.get<{ pages: FacebookPage[] }>('/api/social/facebook/pages');
      setFacebookPages(data.pages);
    } catch (error) {
      setFacebookError(error instanceof Error ? error.message : 'Failed to load Facebook Pages');
    } finally {
      setFacebookBusy(null);
    }
  }

  function connectFacebook() {
    window.location.href = '/api/social/facebook/connect';
  }

  async function selectFacebookPage(pageId: string) {
    setFacebookBusy(`select:${pageId}`);
    setFacebookError(null);
    try {
      const data = await api.post<{ connection: FacebookConnection }>('/api/social/facebook/pages/select', { page_id: pageId });
      setFacebookStatus((prev) => ({ configured: prev?.configured ?? true, connection: data.connection }));
      setFacebookPages([]);
      addToast('Facebook Page connected', 'success');
    } catch (error) {
      setFacebookError(error instanceof Error ? error.message : 'Failed to connect Facebook Page');
    } finally {
      setFacebookBusy(null);
    }
  }

  async function facebookAction(action: 'sync-pages' | 'test-connection' | 'test-post' | 'disconnect') {
    setFacebookBusy(action);
    setFacebookError(null);
    try {
      const result = await api.post<any>(`/api/social/facebook/${action}`, {});
      if (action === 'disconnect') {
        await loadFacebookStatus();
        addToast('Facebook disconnected', 'success');
      } else if (action === 'test-post') {
        addToast(result.post_id ? `Test post published: ${result.post_id}` : 'Test post published', 'success');
      } else {
        await loadFacebookStatus();
        addToast(action === 'sync-pages' ? 'Facebook Page synced' : 'Facebook connection verified', 'success');
      }
    } catch (error) {
      setFacebookError(error instanceof Error ? error.message : 'Facebook action failed');
    } finally {
      setFacebookBusy(null);
    }
  }

  async function loadInstagramStatus() {
    const status = await api.get<InstagramStatus>('/api/social/instagram/status');
    setInstagramStatus(status);
  }

  async function loadInstagramAccounts() {
    setInstagramBusy('accounts');
    try {
      const data = await api.get<{ accounts: InstagramAccount[] }>('/api/social/instagram/accounts');
      setInstagramAccounts(data.accounts);
      if (data.accounts.length === 0) {
        setInstagramError('No connected Instagram Professional account found. Make sure the Instagram account is Business or Creator and connected to a Facebook Page you manage.');
      }
    } catch (error) {
      setInstagramError(error instanceof Error ? error.message : 'Failed to load Instagram accounts');
    } finally {
      setInstagramBusy(null);
    }
  }

  function connectInstagram() {
    window.location.href = '/api/social/instagram/connect';
  }

  async function selectInstagramAccount(account: InstagramAccount) {
    setInstagramBusy(`select:${account.ig_user_id}`);
    setInstagramError(null);
    try {
      const data = await api.post<{ connection: InstagramConnection }>('/api/social/instagram/accounts/select', {
        ig_user_id: account.ig_user_id,
        linked_facebook_page_id: account.linked_facebook_page_id,
      });
      setInstagramStatus((prev) => ({ configured: prev?.configured ?? true, connection: data.connection }));
      setInstagramAccounts([]);
      addToast('Instagram account connected', 'success');
    } catch (error) {
      setInstagramError(error instanceof Error ? error.message : 'Failed to connect Instagram account');
    } finally {
      setInstagramBusy(null);
    }
  }

  async function instagramAction(action: 'sync-accounts' | 'test-connection' | 'test-post' | 'disconnect') {
    setInstagramBusy(action);
    setInstagramError(null);
    try {
      if (action === 'test-post') {
        const imageUrl = window.prompt('Public HTTPS image URL for the Instagram test post');
        if (!imageUrl) {
          setInstagramBusy(null);
          return;
        }
        await api.post<any>('/api/social/instagram/test-post', { image_url: imageUrl });
        addToast('Instagram test image post published', 'success');
      } else {
        await api.post<any>(`/api/social/instagram/${action}`, {});
        if (action === 'disconnect') {
          addToast('Instagram disconnected', 'success');
        } else {
          addToast(action === 'sync-accounts' ? 'Instagram account synced' : 'Instagram connection verified', 'success');
        }
      }
      await loadInstagramStatus();
    } catch (error) {
      setInstagramError(error instanceof Error ? error.message : 'Instagram action failed');
    } finally {
      setInstagramBusy(null);
    }
  }

  async function loadLinkedInStatus() {
    const status = await api.get<LinkedInStatus>('/api/social/linkedin/status');
    setLinkedinStatus(status);
  }

  async function loadLinkedInOrganizations() {
    setLinkedinBusy('organizations');
    try {
      const data = await api.get<{ organizations: LinkedInOrganization[] }>('/api/social/linkedin/organizations');
      setLinkedinOrganizations(data.organizations);
      if (data.organizations.length === 0) {
        setLinkedinError('No LinkedIn Organization Pages found for this account. Make sure the connecting user is an admin of the LinkedIn Page and that the LinkedIn app has approved organization permissions.');
      }
    } catch (error) {
      setLinkedinError(error instanceof Error ? error.message : 'Failed to load LinkedIn Organization Pages');
    } finally {
      setLinkedinBusy(null);
    }
  }

  function connectLinkedIn() {
    window.location.href = '/api/social/linkedin/connect';
  }

  async function selectLinkedInOrganization(organization: LinkedInOrganization) {
    setLinkedinBusy(`select:${organization.organization_urn}`);
    setLinkedinError(null);
    try {
      const data = await api.post<{ connection: LinkedInConnection }>('/api/social/linkedin/organizations/select', {
        organization_urn: organization.organization_urn,
      });
      setLinkedinStatus((prev) => ({ configured: prev?.configured ?? true, connection: data.connection }));
      setLinkedinOrganizations([]);
      addToast('LinkedIn Organization Page connected', 'success');
    } catch (error) {
      setLinkedinError(error instanceof Error ? error.message : 'Failed to connect LinkedIn Organization Page');
    } finally {
      setLinkedinBusy(null);
    }
  }

  async function linkedinAction(action: 'sync-organizations' | 'test-connection' | 'test-post' | 'disconnect') {
    setLinkedinBusy(action);
    setLinkedinError(null);
    try {
      if (action === 'test-post') {
        const commentary = window.prompt('LinkedIn test post commentary', 'Test post from the ecommerce social platform.');
        if (!commentary) {
          setLinkedinBusy(null);
          return;
        }
        const linkUrl = window.prompt('Optional link URL for the LinkedIn test post') || undefined;
        const result = await api.post<any>('/api/social/linkedin/test-post', { commentary, link_url: linkUrl });
        addToast(result.post_id ? `LinkedIn test post published: ${result.post_id}` : 'LinkedIn test post published', 'success');
      } else {
        await api.post<any>(`/api/social/linkedin/${action}`, {});
        if (action === 'disconnect') {
          addToast('LinkedIn disconnected', 'success');
        } else {
          addToast(action === 'sync-organizations' ? 'LinkedIn Organization Page synced' : 'LinkedIn connection verified', 'success');
        }
      }
      await loadLinkedInStatus();
    } catch (error) {
      setLinkedinError(error instanceof Error ? error.message : 'LinkedIn action failed');
    } finally {
      setLinkedinBusy(null);
    }
  }

  async function loadTikTokStatus() {
    const status = await api.get<TikTokStatus>('/api/social/tiktok/status');
    setTiktokStatus(status);
  }

  function connectTikTok() {
    window.location.href = '/api/social/tiktok/connect';
  }

  async function tiktokAction(action: 'test-connection' | 'test-upload' | 'publish-status' | 'disconnect') {
    setTiktokBusy(action);
    setTiktokError(null);
    try {
      if (action === 'test-upload') {
        const videoUrl = window.prompt('Public HTTPS video URL for the TikTok test upload');
        if (!videoUrl) {
          setTiktokError('TikTok requires a public HTTPS video URL for this test.');
          setTiktokBusy(null);
          return;
        }
        const title = window.prompt('Optional TikTok test upload title') || undefined;
        const result = await api.post<any>('/api/social/tiktok/test-upload', { video_url: videoUrl, title });
        addToast(result.publish_id ? `TikTok upload sent: ${result.publish_id}` : 'TikTok upload sent', 'success');
      } else if (action === 'publish-status') {
        const publishId = window.prompt('TikTok publish_id to check');
        if (!publishId) {
          setTiktokBusy(null);
          return;
        }
        const result = await api.get<any>(`/api/social/tiktok/publish-status?publish_id=${encodeURIComponent(publishId)}`);
        addToast(result.status?.status ? `TikTok status: ${result.status.status}` : 'TikTok status checked', 'success');
      } else {
        await api.post<any>(`/api/social/tiktok/${action}`, {});
        if (action === 'disconnect') {
          addToast('TikTok disconnected', 'success');
        } else {
          addToast('TikTok connection verified', 'success');
        }
      }
      await loadTikTokStatus();
    } catch (error) {
      setTiktokError(error instanceof Error ? error.message : 'TikTok action failed');
    } finally {
      setTiktokBusy(null);
    }
  }

  async function loadXStatus() {
    const status = await api.get<XStatus>('/api/social/x/status');
    setXStatus(status);
  }

  function connectX() {
    window.location.href = '/api/social/x/connect';
  }

  async function loadYoutubeStatus() {
    const status = await api.get<YouTubeStatus>('/api/social/youtube/status');
    setYoutubeStatus(status);
  }

  async function loadPinterestStatus() {
    const status = await api.get<PinterestStatus>('/api/social/pinterest/status');
    setPinterestStatus(status);
  }

  function connectPinterest() {
    window.location.href = '/api/social/pinterest/connect';
  }

  async function pinterestAction(action: 'test-connection' | 'disconnect') {
    setPinterestBusy(action);
    setPinterestError(null);
    try {
      await api.post<any>(`/api/social/pinterest/${action}`, {});
      addToast(action === 'disconnect' ? 'Pinterest disconnected' : 'Pinterest connection verified', 'success');
      await loadPinterestStatus();
    } catch (err) {
      setPinterestError(err instanceof Error ? err.message : 'Pinterest action failed');
    } finally { setPinterestBusy(null); }
  }

  async function loadThreadsStatus() {
    const status = await api.get<ThreadsStatus>('/api/social/threads/status');
    setThreadsStatus(status);
  }

  function connectThreads() {
    window.location.href = '/api/social/threads/connect';
  }

  async function threadsAction(action: 'test-connection' | 'disconnect') {
    setThreadsBusy(action);
    setThreadsError(null);
    try {
      await api.post<any>(`/api/social/threads/${action}`, {});
      addToast(action === 'disconnect' ? 'Threads disconnected' : 'Threads connection verified', 'success');
      await loadThreadsStatus();
    } catch (err) {
      setThreadsError(err instanceof Error ? err.message : 'Threads action failed');
    } finally { setThreadsBusy(null); }
  }

  function connectYoutube() {
    window.location.href = '/api/social/youtube/connect';
  }

  async function youtubeAction(action: 'test-connection' | 'disconnect') {
    setYoutubeBusy(action);
    setYoutubeError(null);
    try {
      await api.post<any>(`/api/social/youtube/${action}`, {});
      addToast(action === 'disconnect' ? 'YouTube disconnected' : 'YouTube connection verified', 'success');
      await loadYoutubeStatus();
    } catch (err) {
      setYoutubeError(err instanceof Error ? err.message : 'YouTube action failed');
    } finally { setYoutubeBusy(null); }
  }

  async function xAction(action: 'test-connection' | 'test-post' | 'disconnect') {
    setXBusy(action);
    setXError(null);
    try {
      if (action === 'test-post') {
        const text = window.prompt(
          'X/Twitter test post text',
          'Test post from the ecommerce social platform. This confirms X/Twitter publishing is connected.'
        );
        if (!text) {
          setXBusy(null);
          return;
        }
        const result = await api.post<any>('/api/social/x/test-post', { text });
        addToast(result.post_id ? `X/Twitter test post published: ${result.post_id}` : 'X/Twitter test post published', 'success');
      } else {
        await api.post<any>(`/api/social/x/${action}`, {});
        if (action === 'disconnect') {
          addToast('X/Twitter disconnected', 'success');
        } else {
          addToast('X/Twitter connection verified', 'success');
        }
      }
      await loadXStatus();
    } catch (error) {
      setXError(error instanceof Error ? error.message : 'X/Twitter action failed');
    } finally {
      setXBusy(null);
    }
  }

  if (loading) return <div className="text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Social Platforms</h1>
        <p className="text-sm text-gray-500 mt-1">
          Enable platforms, customise prompts and hashtags, and control auto-publishing.
          Credentials are managed via environment variables — never entered here.
        </p>
      </div>

      <div className="space-y-3">
        {platforms.map((p) => {
          const isOpen = !!expanded[p.platform];
          const statusMeta = STATUS_META[p.setup_status] ?? STATUS_META.not_configured;
          const StatusIcon = statusMeta.icon;
          const isYoutube = false; // YouTube now has OAuth; toggle enabled normally

          return (
            <div key={p.platform} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Platform header row */}
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center font-bold text-sm text-gray-600 shrink-0">
                  {PLATFORM_ICONS[p.platform] ?? p.display_name[0]}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-900 text-sm">{p.display_name}</span>
                    <span className={`flex items-center gap-1 text-xs font-medium ${statusMeta.color}`}>
                      <StatusIcon size={12} />
                      {statusMeta.label}
                    </span>
                  </div>
                  {p.setup_notes && p.setup_status !== 'active' && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{p.setup_notes}</p>
                  )}
                </div>

                {/* Enable toggle — disabled for youtube and unconfigured platforms */}
                <label className={`relative inline-flex items-center cursor-pointer ${isYoutube ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={p.enabled}
                    disabled={isYoutube}
                    onChange={(e) => {
                    const updated = { ...p, enabled: e.target.checked };
                    update(p.platform, 'enabled', e.target.checked);
                    updateStrategy(p.platform, 'enabled', e.target.checked);
                    save(updated);
                  }}
                  />
                  <div className="w-10 h-5 bg-gray-200 peer-checked:bg-brand rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                </label>

                <button
                  onClick={() => toggle(p.platform)}
                  className="text-gray-500 hover:text-gray-700 ml-1"
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                >
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded config */}
              {isOpen && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-5 bg-gray-50">

                  {/* Setup instructions banner */}
                  {p.setup_notes && (
                    <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2 text-sm text-amber-800">
                      <AlertCircle size={15} className="mt-0.5 shrink-0" />
                      <div>
                        <span>{p.setup_notes}</span>
                        {PLATFORM_LINKS[p.platform] && (
                          <a
                            href={PLATFORM_LINKS[p.platform]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 inline-flex items-center gap-1 underline text-amber-700 hover:text-amber-900"
                          >
                            Open developer portal <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}

                  {p.platform === 'facebook' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Connection</p>
                          {!facebookStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Server credentials not configured</p>
                          ) : facebookStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected</p>
                          ) : facebookStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not Connected</p>
                          )}
                        </div>

                        <button
                          onClick={connectFacebook}
                          disabled={!facebookStatus?.configured}
                          className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ExternalLink size={15} />
                          {facebookStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect Facebook'}
                        </button>
                      </div>

                      {facebookError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          {facebookError}
                        </div>
                      )}

                      {!facebookStatus?.connection || facebookStatus.connection.status === 'disconnected' ? (
                        <p className="text-sm text-gray-500">
                          Connect a Facebook Page to publish posts from the Outbox. Settings below can be prepared before connecting.
                        </p>
                      ) : (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Page</p>
                            <p className="text-gray-900">{facebookStatus.connection.display_name || 'Facebook Page'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Page ID</p>
                            <p className="text-gray-900 font-mono text-xs break-all">{facebookStatus.connection.external_account_id}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Connected by</p>
                            <p className="text-gray-700">{facebookStatus.connection.connected_by_user_id || 'Admin'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Permissions</p>
                            <p className="text-gray-700">{facebookStatus.connection.scopes.join(', ') || 'Not recorded'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last checked</p>
                            <p className="text-gray-700">{facebookStatus.connection.last_checked_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last sync</p>
                            <p className="text-gray-700">{facebookStatus.connection.last_synced_at || '-'}</p>
                          </div>
                          {facebookStatus.connection.last_error && (
                            <div className="sm:col-span-2">
                              <p className="text-xs font-medium uppercase text-gray-400">Last error</p>
                              <p className="text-red-600">{facebookStatus.connection.last_error}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {facebookPages.length > 0 && (
                        <div className="border border-blue-100 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-blue-50 text-sm font-medium text-blue-900">Select a Facebook Page</div>
                          <div className="divide-y divide-gray-100">
                            {facebookPages.map((page) => (
                              <div key={page.page_id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{page.name}</p>
                                  <p className="text-xs text-gray-500 font-mono">{page.page_id}</p>
                                  {page.category && <p className="text-xs text-gray-400">{page.category}</p>}
                                </div>
                                <button
                                  onClick={() => selectFacebookPage(page.page_id)}
                                  disabled={facebookBusy === `select:${page.page_id}`}
                                  className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
                                >
                                  {page.connected ? 'Use This Page' : 'Select'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => facebookStatus?.connection ? facebookAction('sync-pages') : loadFacebookPages()}
                          disabled={facebookBusy === 'pages' || facebookBusy === 'sync-pages'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw size={14} />
                          Sync Pages
                        </button>
                        <button
                          onClick={() => facebookAction('test-connection')}
                          disabled={!facebookStatus?.connection || facebookBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Test Connection
                        </button>
                        <button
                          onClick={() => facebookAction('test-post')}
                          disabled={!facebookStatus?.connection || facebookBusy === 'test-post'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Send size={14} />
                          Test Post
                        </button>
                        <button
                          onClick={() => facebookAction('disconnect')}
                          disabled={!facebookStatus?.connection || facebookBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Unplug size={14} />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {p.platform === 'instagram' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Connection</p>
                          {!instagramStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Server credentials not configured.</p>
                          ) : instagramStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected</p>
                          ) : instagramStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not Connected</p>
                          )}
                        </div>

                        <button
                          onClick={connectInstagram}
                          disabled={!instagramStatus?.configured}
                          className="inline-flex items-center justify-center gap-2 bg-pink-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ExternalLink size={15} />
                          {instagramStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect Instagram'}
                        </button>
                      </div>

                      {instagramError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          {instagramError}
                        </div>
                      )}

                      {!instagramStatus?.connection || instagramStatus.connection.status === 'disconnected' ? (
                        <div className="space-y-2 text-sm text-gray-500">
                          <p>Connect an Instagram Professional account to publish image posts from the Outbox.</p>
                          <p className="text-amber-700">Instagram publishing requires a Business or Creator account connected to a Facebook Page.</p>
                        </div>
                      ) : (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Instagram account</p>
                            <p className="text-gray-900">@{instagramStatus.connection.metadata?.instagram_username || instagramStatus.connection.display_name}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">IG User ID</p>
                            <p className="text-gray-900 font-mono text-xs break-all">{instagramStatus.connection.external_account_id}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Linked Facebook Page</p>
                            <p className="text-gray-700">{instagramStatus.connection.metadata?.linked_facebook_page_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Connected by</p>
                            <p className="text-gray-700">{instagramStatus.connection.connected_by_user_id || 'Admin'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Permissions</p>
                            <p className="text-gray-700">{instagramStatus.connection.scopes.join(', ') || 'Not recorded'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last checked</p>
                            <p className="text-gray-700">{instagramStatus.connection.last_checked_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last sync</p>
                            <p className="text-gray-700">{instagramStatus.connection.last_synced_at || '-'}</p>
                          </div>
                          {instagramStatus.connection.last_error && (
                            <div className="sm:col-span-2">
                              <p className="text-xs font-medium uppercase text-gray-400">Last error</p>
                              <p className="text-red-600">{instagramStatus.connection.last_error}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {instagramAccounts.length > 0 && (
                        <div className="border border-pink-100 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-pink-50 text-sm font-medium text-pink-900">Select an Instagram Professional account</div>
                          <div className="divide-y divide-gray-100">
                            {instagramAccounts.map((account) => (
                              <div key={account.ig_user_id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">@{account.username}</p>
                                  {account.name && <p className="text-xs text-gray-500">{account.name}</p>}
                                  <p className="text-xs text-gray-500">Linked Page: {account.linked_facebook_page_name || '-'}</p>
                                  <p className="text-xs text-gray-400 font-mono">{account.ig_user_id}</p>
                                </div>
                                <button
                                  onClick={() => selectInstagramAccount(account)}
                                  disabled={instagramBusy === `select:${account.ig_user_id}`}
                                  className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
                                >
                                  {account.connected ? 'Use This Account' : 'Select'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => instagramStatus?.connection ? instagramAction('sync-accounts') : loadInstagramAccounts()}
                          disabled={instagramBusy === 'accounts' || instagramBusy === 'sync-accounts'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw size={14} />
                          Sync Accounts
                        </button>
                        <button
                          onClick={() => instagramAction('test-connection')}
                          disabled={!instagramStatus?.connection || instagramBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Test Connection
                        </button>
                        <button
                          onClick={() => instagramAction('test-post')}
                          disabled={!instagramStatus?.connection || instagramBusy === 'test-post'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Send size={14} />
                          Test Image Post
                        </button>
                        <button
                          onClick={() => instagramAction('disconnect')}
                          disabled={!instagramStatus?.connection || instagramBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Unplug size={14} />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {p.platform === 'linkedin' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Connection</p>
                          {!linkedinStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Server credentials not configured.</p>
                          ) : linkedinStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected</p>
                          ) : linkedinStatus.connection?.status === 'pending_review' ? (
                            <p className="text-sm text-amber-700 mt-1">Pending App Review or Permissions Missing</p>
                          ) : linkedinStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not Connected</p>
                          )}
                        </div>

                        <button
                          onClick={connectLinkedIn}
                          disabled={!linkedinStatus?.configured}
                          className="inline-flex items-center justify-center gap-2 bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ExternalLink size={15} />
                          {linkedinStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect LinkedIn'}
                        </button>
                      </div>

                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex gap-2">
                        <Clock size={15} className="mt-0.5 shrink-0" />
                        LinkedIn app review may take 1-2 weeks. Register in the LinkedIn Developer portal and request Community Management API / Share on LinkedIn permissions.
                      </div>

                      {linkedinStatus?.connection?.status === 'pending_review' && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          LinkedIn has not approved the required organization posting permissions yet. Request Community Management API access and retry once approved.
                        </div>
                      )}

                      {linkedinError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          {linkedinError}
                        </div>
                      )}

                      {!linkedinStatus?.connection || linkedinStatus.connection.status === 'disconnected' ? (
                        <p className="text-sm text-gray-500">
                          Connect a LinkedIn Organization Page to publish professional posts from the Outbox.
                        </p>
                      ) : (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">LinkedIn Page</p>
                            <p className="text-gray-900">{linkedinStatus.connection.metadata?.localized_name || linkedinStatus.connection.display_name}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Organization ID / URN</p>
                            <p className="text-gray-900 font-mono text-xs break-all">{linkedinStatus.connection.metadata?.organization_urn || linkedinStatus.connection.external_account_id}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Vanity name</p>
                            <p className="text-gray-700">{linkedinStatus.connection.metadata?.vanity_name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Connected by</p>
                            <p className="text-gray-700">{linkedinStatus.connection.metadata?.connection_owner_email || linkedinStatus.connection.connected_by_user_id || 'Admin'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Permissions granted</p>
                            <p className="text-gray-700">{linkedinStatus.connection.scopes.join(', ') || 'Not recorded'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Token expires</p>
                            <p className="text-gray-700">{linkedinStatus.connection.token_expires_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last checked</p>
                            <p className="text-gray-700">{linkedinStatus.connection.last_checked_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last sync</p>
                            <p className="text-gray-700">{linkedinStatus.connection.last_synced_at || '-'}</p>
                          </div>
                          {linkedinStatus.connection.last_error && (
                            <div className="sm:col-span-2">
                              <p className="text-xs font-medium uppercase text-gray-400">Last error</p>
                              <p className="text-red-600">{linkedinStatus.connection.last_error}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {linkedinOrganizations.length > 0 && (
                        <div className="border border-sky-100 rounded-lg overflow-hidden">
                          <div className="px-3 py-2 bg-sky-50 text-sm font-medium text-sky-900">Select a LinkedIn Organization Page</div>
                          <div className="divide-y divide-gray-100">
                            {linkedinOrganizations.map((organization) => (
                              <div key={organization.organization_urn} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{organization.name}</p>
                                  {organization.vanity_name && <p className="text-xs text-gray-500">/{organization.vanity_name}</p>}
                                  <p className="text-xs text-gray-400 font-mono break-all">{organization.organization_urn}</p>
                                </div>
                                <button
                                  onClick={() => selectLinkedInOrganization(organization)}
                                  disabled={linkedinBusy === `select:${organization.organization_urn}`}
                                  className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50"
                                >
                                  {organization.connected ? 'Use This Page' : 'Select'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => linkedinStatus?.connection ? linkedinAction('sync-organizations') : loadLinkedInOrganizations()}
                          disabled={linkedinBusy === 'organizations' || linkedinBusy === 'sync-organizations'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw size={14} />
                          Sync Organizations
                        </button>
                        <button
                          onClick={() => linkedinAction('test-connection')}
                          disabled={!linkedinStatus?.connection || linkedinBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Test Connection
                        </button>
                        <button
                          onClick={() => linkedinAction('test-post')}
                          disabled={!linkedinStatus?.connection || linkedinBusy === 'test-post' || linkedinStatus.connection.status === 'pending_review'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Send size={14} />
                          Test Post
                        </button>
                        <button
                          onClick={() => linkedinAction('disconnect')}
                          disabled={!linkedinStatus?.connection || linkedinBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Unplug size={14} />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {p.platform === 'tiktok' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Connection</p>
                          {!tiktokStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Server credentials not configured.</p>
                          ) : tiktokStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected</p>
                          ) : tiktokStatus.connection?.status === 'pending_review' ? (
                            <p className="text-sm text-amber-700 mt-1">Pending App Review or Permissions Missing</p>
                          ) : tiktokStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not Connected</p>
                          )}
                        </div>

                        <button
                          onClick={connectTikTok}
                          disabled={!tiktokStatus?.configured}
                          className="inline-flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ExternalLink size={15} />
                          {tiktokStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect TikTok'}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex gap-2">
                          <Clock size={15} className="mt-0.5 shrink-0" />
                          TikTok app review can take 1-4 weeks. Submit your app at the TikTok Developer portal early to avoid delays.
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          TikTok publishing requires video or photo media. Text-only posts are not supported.
                        </div>
                        {!tiktokStatus?.direct_post_feature_enabled && (
                          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-700 flex gap-2">
                            <AlertCircle size={15} className="mt-0.5 shrink-0" />
                            Direct Post is disabled until the TikTok app is approved for video.publish.
                          </div>
                        )}
                      </div>

                      {tiktokError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          {tiktokError}
                        </div>
                      )}

                      {!tiktokStatus?.connection || tiktokStatus.connection.status === 'disconnected' ? (
                        <p className="text-sm text-gray-500">
                          Connect a TikTok account to upload videos from the Outbox.
                        </p>
                      ) : (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">TikTok account</p>
                            <p className="text-gray-900">{tiktokStatus.connection.metadata?.display_name || tiktokStatus.connection.display_name}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Open ID</p>
                            <p className="text-gray-900 font-mono text-xs break-all">{tiktokStatus.connection.metadata?.open_id || tiktokStatus.connection.external_account_id}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Permissions granted</p>
                            <p className="text-gray-700">{tiktokStatus.connection.scopes.join(', ') || 'Not recorded'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Token expires</p>
                            <p className="text-gray-700">{tiktokStatus.connection.token_expires_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Upload-to-Inbox</p>
                            <p className={tiktokStatus.connection.metadata?.upload_to_inbox_enabled ? 'text-green-700' : 'text-amber-700'}>
                              {tiktokStatus.connection.metadata?.upload_to_inbox_enabled ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Direct Post</p>
                            <p className={tiktokStatus.connection.metadata?.direct_post_enabled ? 'text-green-700' : 'text-gray-700'}>
                              {tiktokStatus.connection.metadata?.direct_post_enabled ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last checked</p>
                            <p className="text-gray-700">{tiktokStatus.connection.last_checked_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last sync/status</p>
                            <p className="text-gray-700">{tiktokStatus.connection.last_synced_at || '-'}</p>
                          </div>
                          {tiktokStatus.connection.last_error && (
                            <div className="sm:col-span-2">
                              <p className="text-xs font-medium uppercase text-gray-400">Last error</p>
                              <p className="text-red-600">{tiktokStatus.connection.last_error}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => tiktokAction('test-connection')}
                          disabled={!tiktokStatus?.connection || tiktokBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Test Connection
                        </button>
                        <button
                          onClick={() => tiktokAction('test-upload')}
                          disabled={!tiktokStatus?.connection || tiktokBusy === 'test-upload' || !tiktokStatus.connection.metadata?.upload_to_inbox_enabled}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Send size={14} />
                          Test Upload
                        </button>
                        <button
                          onClick={() => tiktokAction('publish-status')}
                          disabled={!tiktokStatus?.connection || tiktokBusy === 'publish-status'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw size={14} />
                          Check Publish Status
                        </button>
                        <button
                          onClick={() => tiktokAction('disconnect')}
                          disabled={!tiktokStatus?.connection || tiktokBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Unplug size={14} />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {p.platform === 'youtube' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">YouTube Channel</p>
                          {!youtubeStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Server credentials not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI.</p>
                          ) : youtubeStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected — {youtubeStatus.connection.metadata?.channel_title ?? youtubeStatus.connection.display_name}</p>
                          ) : youtubeStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not connected</p>
                          )}
                        </div>
                        <button onClick={connectYoutube} disabled={!youtubeStatus?.configured}
                          className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                          <ExternalLink size={15} />
                          {youtubeStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect YouTube'}
                        </button>
                      </div>

                      {youtubeError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />{youtubeError}
                        </div>
                      )}

                      {youtubeStatus?.connection?.status === 'connected' && (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Channel</p>
                            <p className="text-gray-900">{youtubeStatus.connection.metadata?.channel_title ?? youtubeStatus.connection.display_name}</p>
                          </div>
                          {youtubeStatus.connection.metadata?.custom_url && (
                            <div>
                              <p className="text-xs font-medium uppercase text-gray-400">URL</p>
                              <p className="text-gray-900">{youtubeStatus.connection.metadata.custom_url}</p>
                            </div>
                          )}
                          {youtubeStatus.connection.metadata?.subscriber_count && (
                            <div>
                              <p className="text-xs font-medium uppercase text-gray-400">Subscribers</p>
                              <p className="text-gray-900">{parseInt(youtubeStatus.connection.metadata.subscriber_count).toLocaleString()}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => youtubeAction('test-connection')}
                          disabled={!youtubeStatus?.connection || youtubeBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                          <CheckCircle size={14} /> Test Connection
                        </button>
                        <button onClick={connectYoutube} disabled={!youtubeStatus?.configured}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                          <RefreshCw size={14} /> Reconnect
                        </button>
                        <button onClick={() => youtubeAction('disconnect')}
                          disabled={!youtubeStatus?.connection || youtubeBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Unplug size={14} /> Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {p.platform === 'pinterest' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Pinterest Account</p>
                          {!pinterestStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Credentials not configured. Set PINTEREST_CLIENT_ID and PINTEREST_CLIENT_SECRET.</p>
                          ) : pinterestStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected — {pinterestStatus.connection.metadata?.display_name ?? pinterestStatus.connection.display_name}</p>
                          ) : pinterestStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error — reconnect to fix</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not connected</p>
                          )}
                        </div>
                        <button onClick={connectPinterest} disabled={!pinterestStatus?.configured}
                          className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50">
                          <ExternalLink size={15} />
                          {pinterestStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect Pinterest'}
                        </button>
                      </div>

                      {pinterestError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />{pinterestError}
                        </div>
                      )}

                      {pinterestStatus?.connection?.status === 'connected' && (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Username</p>
                            <p className="text-gray-900">{pinterestStatus.connection.metadata?.username ?? pinterestStatus.connection.display_name}</p>
                          </div>
                          {pinterestStatus.connection.metadata?.default_board_name && (
                            <div>
                              <p className="text-xs font-medium uppercase text-gray-400">Default Board</p>
                              <p className="text-gray-900">{pinterestStatus.connection.metadata.default_board_name}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => pinterestAction('test-connection')}
                          disabled={!pinterestStatus?.connection || pinterestBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                          <CheckCircle size={14} /> Test Connection
                        </button>
                        <button onClick={connectPinterest} disabled={!pinterestStatus?.configured}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                          <RefreshCw size={14} /> Reconnect
                        </button>
                        <button onClick={() => pinterestAction('disconnect')}
                          disabled={!pinterestStatus?.connection || pinterestBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Unplug size={14} /> Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {p.platform === 'threads' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Threads Account</p>
                          {!threadsStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Credentials not configured. Set META_APP_ID, META_APP_SECRET, META_THREADS_REDIRECT_URI in .env</p>
                          ) : threadsStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected — @{threadsStatus.connection.metadata?.username ?? threadsStatus.connection.display_name}</p>
                          ) : threadsStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error — reconnect to fix</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not connected</p>
                          )}
                        </div>
                        <button onClick={connectThreads} disabled={!threadsStatus?.configured}
                          className="inline-flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50">
                          <ExternalLink size={15} />
                          {threadsStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect Threads'}
                        </button>
                      </div>

                      {!threadsStatus?.configured && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-800 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          Threads reuses your existing Meta App ID and Secret. Add META_THREADS_REDIRECT_URI to .env and register it in the Meta developer portal under the Threads product.
                        </div>
                      )}

                      {threadsError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />{threadsError}
                        </div>
                      )}

                      {threadsStatus?.connection?.status === 'connected' && (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Username</p>
                            <p className="text-gray-900">@{threadsStatus.connection.metadata?.username ?? threadsStatus.connection.display_name}</p>
                          </div>
                          {threadsStatus.connection.metadata?.biography && (
                            <div>
                              <p className="text-xs font-medium uppercase text-gray-400">Bio</p>
                              <p className="text-gray-700 truncate">{threadsStatus.connection.metadata.biography}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => threadsAction('test-connection')}
                          disabled={!threadsStatus?.connection || threadsBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                          <CheckCircle size={14} /> Test Connection
                        </button>
                        <button onClick={connectThreads} disabled={!threadsStatus?.configured}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                          <RefreshCw size={14} /> Reconnect
                        </button>
                        <button onClick={() => threadsAction('disconnect')}
                          disabled={!threadsStatus?.connection || threadsBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Unplug size={14} /> Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {p.platform === 'x' && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">Connection</p>
                          {!xStatus?.configured ? (
                            <p className="text-sm text-red-600 mt-1">Server credentials not configured.</p>
                          ) : xStatus.connection?.status === 'connected' ? (
                            <p className="text-sm text-green-700 mt-1">Connected</p>
                          ) : xStatus.connection?.status === 'pending_api_access' ? (
                            <p className="text-sm text-amber-700 mt-1">Pending API Access</p>
                          ) : xStatus.connection?.status === 'error' ? (
                            <p className="text-sm text-red-600 mt-1">Connection error</p>
                          ) : (
                            <p className="text-sm text-gray-500 mt-1">Not Connected</p>
                          )}
                        </div>

                        <button
                          onClick={connectX}
                          disabled={!xStatus?.configured}
                          className="inline-flex items-center justify-center gap-2 bg-black text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ExternalLink size={15} />
                          {xStatus?.connection?.status === 'connected' ? 'Reconnect' : 'Connect X/Twitter'}
                        </button>
                      </div>

                      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                        <AlertCircle size={15} className="mt-0.5 shrink-0" />
                        X API write access requires an approved developer app with write permissions and paid/usage-enabled API access. Confirm access in the X Developer Portal before enabling auto-publish.
                      </div>

                      {xError && (
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          {xError}
                        </div>
                      )}

                      {!xStatus?.connection || xStatus.connection.status === 'disconnected' ? (
                        <p className="text-sm text-gray-500">
                          Connect a brand X account to publish posts from the Outbox.
                        </p>
                      ) : (
                        <div className="grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">X account</p>
                            <p className="text-gray-900">
                              {xStatus.connection.metadata?.username ? `@${xStatus.connection.metadata.username}` : xStatus.connection.display_name}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Display name</p>
                            <p className="text-gray-900">{xStatus.connection.display_name || xStatus.connection.metadata?.name || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">X user ID</p>
                            <p className="text-gray-900 font-mono text-xs break-all">{xStatus.connection.external_account_id}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Permissions granted</p>
                            <p className="text-gray-700">{xStatus.connection.scopes.join(', ') || 'Not recorded'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Token expires</p>
                            <p className="text-gray-700">{xStatus.connection.token_expires_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Last checked</p>
                            <p className="text-gray-700">{xStatus.connection.last_checked_at || '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-gray-400">Media Posts</p>
                            <p className={xStatus.media_posts_enabled ? 'text-green-700' : 'text-gray-700'}>
                              {xStatus.media_posts_enabled ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                          {xStatus.connection.last_error && (
                            <div className="sm:col-span-2">
                              <p className="text-xs font-medium uppercase text-gray-400">Last error</p>
                              <p className="text-red-600">{xStatus.connection.last_error}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => xAction('test-connection')}
                          disabled={!xStatus?.connection || xBusy === 'test-connection'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <CheckCircle size={14} />
                          Test Connection
                        </button>
                        <button
                          onClick={() => xAction('test-post')}
                          disabled={!xStatus?.connection || xBusy === 'test-post' || xStatus.connection.status === 'pending_api_access'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Send size={14} />
                          Test Post
                        </button>
                        <button
                          onClick={connectX}
                          disabled={!xStatus?.configured}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RefreshCw size={14} />
                          Reconnect
                        </button>
                        <button
                          onClick={() => xAction('disconnect')}
                          disabled={!xStatus?.connection || xBusy === 'disconnect'}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-100 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          <Unplug size={14} />
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Scheduling Strategy ─────────────────────────────── */}
                  {!isYoutube && strategy[p.platform] && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
                      <p className="text-sm font-semibold text-gray-900">Scheduling Strategy</p>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">Posts Per Day</label>
                          <input
                            type="number" min={1} max={50}
                            value={strategy[p.platform].posts_per_day}
                            onChange={(e) => updateStrategy(p.platform, 'posts_per_day', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand outline-none bg-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-600 block mb-1">
                            Best Times ({storeTimezone.replace('America/', '').replace('_', ' ')})
                          </label>
                          <input
                            type="text"
                            value={strategy[p.platform].best_times?.join(', ') || ''}
                            onChange={(e) => updateStrategy(p.platform, 'best_times', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                            placeholder="09:00, 12:00, 18:00"
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-brand outline-none bg-white"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 block mb-2">
                          Content Mix
                          <span className="ml-2 font-normal text-gray-400">
                            (total: {Object.values(strategy[p.platform].content_mix || {}).reduce((s, v) => s + Math.round((v <= 1 ? v * 100 : v)), 0)}%)
                          </span>
                        </label>
                        <div className="space-y-2">
                          {Object.entries(strategy[p.platform].content_mix || {}).map(([type, pct]) => {
                            const display = Math.round(pct <= 1 ? pct * 100 : pct);
                            return (
                              <div key={type} className="flex items-center gap-3">
                                <span className="text-xs text-gray-600 capitalize w-28 shrink-0">{type.replace('_', ' ')}</span>
                                <input
                                  type="range" min={0} max={100} step={5}
                                  value={display}
                                  onChange={(e) => {
                                    const newMix = { ...strategy[p.platform].content_mix, [type]: parseInt(e.target.value) / 100 };
                                    updateStrategy(p.platform, 'content_mix', newMix);
                                  }}
                                  className="flex-1"
                                />
                                <span className="text-xs font-medium text-gray-800 w-9 text-right">{display}%</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="mt-1.5 text-xs text-gray-400">Must add to 100%. Used by the AI scheduler to balance content types.</p>
                      </div>
                    </div>
                  )}

                  {!isYoutube && (
                    <>
                      {/* Prompt template */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Custom Prompt Template
                        </label>
                        <textarea
                          rows={4}
                          value={p.prompt_template ?? ''}
                          onChange={(e) => update(p.platform, 'prompt_template', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm resize-y bg-white"
                          placeholder={`Leave blank to use the built-in ${p.display_name} prompt template. The brand persona and voice are always applied on top.`}
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          Override the AI instructions for {p.display_name} only. Brand persona is always injected regardless.
                        </p>
                      </div>

                      {/* Hashtag mode */}
                      <div>
                        <label className="text-sm font-medium text-gray-700 block mb-1">
                          Hashtag Strategy
                        </label>
                        <select
                          value={p.hashtag_mode}
                          onChange={(e) => update(p.platform, 'hashtag_mode', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm bg-white"
                        >
                          {Object.entries(HASHTAG_MODE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-400">
                          Auto = AI suggests per-post hashtags. Manual = you add them in the Outbox. None = no hashtags (recommended for Facebook).
                        </p>
                      </div>

                      {/* Max images — always visible regardless of hashtag mode */}
                      <div>
                        <label htmlFor={`max-images-${p.platform}`} className="text-sm font-medium text-gray-700 block mb-1">
                          Max Images Per Post
                        </label>
                        <input
                          id={`max-images-${p.platform}`}
                          type="number"
                          min={1}
                          max={50}
                          value={p.max_images_per_post ?? 1}
                          onChange={(e) => update(p.platform, 'max_images_per_post', Number.parseInt(e.target.value) || 1)}
                          className="w-32 px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm bg-white"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                          How many images AI assigns per draft. Capped at 3 for Moment Capture (you only upload 3). Platform API limits: Facebook 10, Instagram 10, LinkedIn 20, X 4, Threads 10, TikTok 35, YouTube 1, Pinterest 1.
                        </p>
                      </div>

                      {p.hashtag_mode !== 'none' && (
                        <>
                          {/* Max hashtags / chars */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-700 block mb-1">
                                Max Hashtags
                              </label>
                              <input
                                type="number"
                                min={0}
                                max={30}
                                value={p.max_hashtags}
                                onChange={(e) => update(p.platform, 'max_hashtags', parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm bg-white"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-700 block mb-1">
                                Max Caption Chars
                              </label>
                              <input
                                type="number"
                                min={1}
                                value={p.max_caption_chars}
                                onChange={(e) => update(p.platform, 'max_caption_chars', parseInt(e.target.value) || 280)}
                                className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm bg-white"
                              />
                            </div>
                          </div>

                          {/* Brand hashtag */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                              Brand Hashtag
                            </label>
                            <input
                              type="text"
                              value={p.brand_hashtag ?? ''}
                              onChange={(e) => update(p.platform, 'brand_hashtag', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm bg-white font-mono"
                              placeholder="#YourBrand"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                              Always appended to every post on this platform.
                            </p>
                          </div>

                          {/* Banned hashtags */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 block mb-1">
                              Banned Hashtags
                            </label>
                            <textarea
                              rows={2}
                              value={p.banned_hashtags ?? ''}
                              onChange={(e) => update(p.platform, 'banned_hashtags', e.target.value)}
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:border-brand outline-none text-sm resize-y bg-white font-mono"
                              placeholder={'#spam\n#followforfollow'}
                            />
                            <p className="mt-1 text-xs text-gray-400">
                              One per line. AI will never suggest these.
                            </p>
                          </div>
                        </>
                      )}

                      {/* Auto-publish toggle */}
                      <div className="flex items-center justify-between py-2 border-t border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Auto-Publish</p>
                          <p className="text-xs text-gray-400">
                            When on, posts go live immediately when a blog is published. When off, posts land in the Outbox for manual approval.
                          </p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer ml-4 shrink-0">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={p.auto_publish}
                            onChange={(e) => update(p.platform, 'auto_publish', e.target.checked)}
                          />
                          <div className="w-10 h-5 bg-gray-200 peer-checked:bg-brand rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5" />
                        </label>
                      </div>

                      {/* X/Twitter API access warning */}
                      {p.platform === 'x' && (
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm text-amber-800 flex gap-2">
                          <AlertCircle size={15} className="mt-0.5 shrink-0" />
                          X API write access requires an approved developer app with write permissions and paid/usage-enabled API access. Confirm access in the X Developer Portal before enabling auto-publish.
                        </div>
                      )}

                      {/* LinkedIn/TikTok setup reminder */}
                      {(p.platform === 'linkedin' || p.platform === 'tiktok') && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700 flex gap-2">
                          <Clock size={15} className="mt-0.5 shrink-0" />
                          {p.platform === 'tiktok'
                            ? 'TikTok app review can take 1–4 weeks. Submit your app at developers.tiktok.com now to avoid delays.'
                            : 'LinkedIn app review takes 1–2 weeks. Register at developer.linkedin.com and request Share on LinkedIn permissions.'}
                        </div>
                      )}

                      <button
                        onClick={() => save(p)}
                        disabled={saving[p.platform]}
                        className="bg-brand text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-brand/90 disabled:opacity-50"
                      >
                        {saving[p.platform] ? 'Saving...' : `Save ${p.display_name}`}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
