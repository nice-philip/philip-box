// shareManager.js
class ShareManager {
    async createShareLink(fileId) {
        try {
            const response = await fetch('/api/share', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId })
            });

            if (!response.ok) {
                throw new Error('링크 생성 실패');
            }

            const data = await response.json();
            return data.shareUrl;
        } catch (error) {
            console.error('공유 링크 생성 오류:', error);
            Utils.showNotification('공유 링크 생성에 실패했습니다.', 'error');
            return null;
        }
    }

    async copyShareLink(fileId) {
        const shareUrl = await this.createShareLink(fileId);
        if (shareUrl) {
            try {
                await navigator.clipboard.writeText(shareUrl);
                Utils.showNotification('공유 링크가 클립보드에 복사되었습니다.');
            } catch (err) {
                Utils.showNotification('복사 실패: 브라우저 권한을 확인해주세요.', 'error');
            }
        }
    }
}

window.shareManager = new ShareManager();
