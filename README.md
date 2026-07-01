# AttendMate

QR 체크인과 실시간 리포트로 출석 관리를 단순하게 만드는 서비스의 랜딩 페이지.

디자인 규칙은 [DESIGN.md](DESIGN.md)를 참고. 순수 HTML/CSS(빌드 도구 없음)로 구성되어 GitHub Pages에 바로 배포할 수 있다.

## 구조

```
index.html                     메인 랜딩 페이지
assets/css/tokens.css          디자인 토큰 (색상 · 타이포 · spacing · radius)
assets/css/base.css            리셋 + 타이포그래피 유틸 클래스
assets/css/components.css      버튼 · 네비 · 타일 · 카드 · 푸터 등 컴포넌트
assets/img/                    스크린샷/목업 플레이스홀더
DESIGN.md                      디자인 규칙 문서
```

## 로컬 미리보기

```bash
python -m http.server 8080
# http://localhost:8080 접속
```

## GitHub Pages 배포

1. 이 폴더를 GitHub 저장소로 push한다 (`main` 브랜치, 루트에 `index.html` 유지).
   ```bash
   git init
   git add .
   git commit -m "Initial AttendMate landing page"
   git branch -M main
   git remote add origin https://github.com/<사용자명>/<저장소명>.git
   git push -u origin main
   ```
2. GitHub 저장소 → **Settings → Pages**로 이동.
3. **Build and deployment → Source**를 `Deploy from a branch`로 설정.
4. **Branch**를 `main` / `/(root)`로 선택 후 저장.
5. 잠시 후 `https://<사용자명>.github.io/<저장소명>/` 에서 접속 가능.

빌드 단계가 없는 정적 사이트이므로 GitHub Actions 워크플로 없이 위 설정만으로 배포된다.
