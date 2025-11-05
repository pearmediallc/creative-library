"""
Python Flask Service for Facebook OAuth and Graph API
Reuses code from /Users/mac/Desktop/metadata tagger
"""

import os
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

# Add metadata tagger path to import existing modules
METADATA_TAGGER_PATH = '/Users/mac/Desktop/metadata tagger'
sys.path.insert(0, METADATA_TAGGER_PATH)

# Import existing Facebook integration (ignoring metadata extraction)
from facebook_integration import facebook_auth
from facebook_api import FacebookGraphAPI

app = Flask(__name__)
CORS(app)

# ============================================
# FACEBOOK OAUTH ENDPOINTS
# ============================================

@app.route('/api/facebook/login-url', methods=['POST'])
def get_login_url():
    """
    Generate Facebook OAuth login URL
    Body: { user_id: string }
    """
    try:
        data = request.json
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id is required'
            }), 400

        result = facebook_auth.get_login_url(user_id)

        return jsonify({
            'success': True,
            'data': result
        })
    except Exception as e:
        print(f'Error generating login URL: {e}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/facebook/callback', methods=['POST'])
def handle_callback():
    """
    Handle Facebook OAuth callback
    Body: { code: string, state: string }
    """
    try:
        data = request.json
        code = data.get('code')
        state = data.get('state')

        if not code or not state:
            return jsonify({
                'success': False,
                'error': 'code and state are required'
            }), 400

        # Verify state
        user_id = facebook_auth.verify_state(state)
        if not user_id:
            return jsonify({
                'success': False,
                'error': 'Invalid or expired state'
            }), 400

        # Exchange code for token
        token_data = facebook_auth.exchange_code_for_token(code)
        access_token = token_data['access_token']

        # Get user info and permissions
        user_info = facebook_auth.get_user_info(access_token)

        # Verify permissions
        perm_check = facebook_auth.verify_permissions(user_info['permissions'])
        if not perm_check['valid']:
            return jsonify({
                'success': False,
                'error': 'Missing required permissions',
                'missing_permissions': perm_check['missing_permissions']
            }), 403

        # Get ad accounts
        ad_accounts = facebook_auth.get_ad_accounts(access_token)

        # Encrypt token for storage
        encrypted_token = facebook_auth.encrypt_token(access_token)

        return jsonify({
            'success': True,
            'data': {
                'user_id': user_id,
                'facebook_user': user_info,
                'encrypted_token': encrypted_token,
                'ad_accounts': ad_accounts
            }
        })
    except Exception as e:
        print(f'Error in Facebook callback: {e}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# FACEBOOK GRAPH API ENDPOINTS
# ============================================

@app.route('/api/facebook/get-campaigns', methods=['POST'])
def get_campaigns():
    """
    Get campaigns for an ad account
    Body: { ad_account_id: string, encrypted_token: string }
    """
    try:
        data = request.json
        ad_account_id = data.get('ad_account_id')
        encrypted_token = data.get('encrypted_token')

        if not ad_account_id:
            return jsonify({
                'success': False,
                'error': 'ad_account_id is required'
            }), 400

        # Decrypt token
        access_token = facebook_auth.decrypt_token(encrypted_token)
        if not access_token:
            return jsonify({
                'success': False,
                'error': 'Invalid or missing access token'
            }), 401

        # Create API client
        api = FacebookGraphAPI(access_token)

        # Get campaigns
        campaigns = api.get_campaigns(ad_account_id)

        return jsonify({
            'success': True,
            'campaigns': campaigns
        })
    except Exception as e:
        print(f'Error fetching campaigns: {e}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/facebook/get-campaign-ads', methods=['POST'])
def get_campaign_ads():
    """
    Get all ads for a campaign
    Body: { ad_account_id: string, campaign_id: string, encrypted_token: string }
    """
    try:
        data = request.json
        ad_account_id = data.get('ad_account_id')
        campaign_id = data.get('campaign_id')
        encrypted_token = data.get('encrypted_token')

        if not campaign_id:
            return jsonify({
                'success': False,
                'error': 'campaign_id is required'
            }), 400

        # Decrypt token
        access_token = facebook_auth.decrypt_token(encrypted_token)
        if not access_token:
            return jsonify({
                'success': False,
                'error': 'Invalid or missing access token'
            }), 401

        # Create API client
        api = FacebookGraphAPI(access_token)

        # Get all ads for campaign
        ads = api.get_all_campaign_ads(campaign_id)

        return jsonify({
            'success': True,
            'ads': ads
        })
    except Exception as e:
        print(f'Error fetching campaign ads: {e}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/facebook/get-ad-accounts', methods=['POST'])
def get_ad_accounts():
    """
    Get user's ad accounts
    Body: { encrypted_token: string }
    """
    try:
        data = request.json
        encrypted_token = data.get('encrypted_token')

        # Decrypt token
        access_token = facebook_auth.decrypt_token(encrypted_token)
        if not access_token:
            return jsonify({
                'success': False,
                'error': 'Invalid or missing access token'
            }), 401

        # Get ad accounts
        ad_accounts = facebook_auth.get_ad_accounts(access_token)

        return jsonify({
            'success': True,
            'ad_accounts': ad_accounts
        })
    except Exception as e:
        print(f'Error fetching ad accounts: {e}')
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# HEALTH CHECK
# ============================================

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'creative-library-python'
    })


if __name__ == '__main__':
    port = int(os.getenv('PORT', 5001))
    app.run(
        host='0.0.0.0',
        port=port,
        debug=os.getenv('FLASK_ENV') == 'development'
    )
