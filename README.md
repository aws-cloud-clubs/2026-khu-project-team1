# 웹훅호호이야
**Frontend**  
![React](https://img.shields.io/badge/React_18-61DAFB?style=flat-square&logo=React&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=TypeScript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=Vite&logoColor=white)
![Tailwind_CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat-square&logo=TailwindCSS&logoColor=white)

**Backend**  

![Spring Boot](https://img.shields.io/badge/Spring_Boot_3.x-6DB33F?style=flat-square&logo=SpringBoot&logoColor=white)
![Java](https://img.shields.io/badge/Java_21-007396?style=flat-square&logo=OpenJDK&logoColor=white)
![Gradle](https://img.shields.io/badge/Gradle-02303A?style=flat-square&logo=Gradle&logoColor=white)

**Infra**  

![Amazon S3](https://img.shields.io/badge/Amazon_S3-569A31?style=flat-square&logo=AmazonS3&logoColor=white)
![CloudFront](https://img.shields.io/badge/CloudFront-FF9900?style=flat-square&logo=AmazonAWS&logoColor=white)
![Amazon EC2](https://img.shields.io/badge/Amazon_EC2-FF9900?style=flat-square&logo=AmazonEC2&logoColor=white)
![Auto Scaling](https://img.shields.io/badge/Auto_Scaling-FF9900?style=flat-square&logo=AmazonAWS&logoColor=white)
![AWS SQS](https://img.shields.io/badge/AWS_SQS-FF4F8B?style=flat-square&logo=AmazonSQS&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=flat-square&logo=AmazonDynamoDB&logoColor=white)
![ALB](https://img.shields.io/badge/Application_Load_Balancer-8C4FFF?style=flat-square&logo=AmazonAWS&logoColor=white)

**Realtime**  

![WebSocket](https://img.shields.io/badge/WebSocket-010101?style=flat-square&logo=Socket.io&logoColor=white)
![STOMP](https://img.shields.io/badge/STOMP-6DB33F?style=flat-square&logo=Spring&logoColor=white)
</br>
- 외부에서 오는 웹훅(알림)을 대신 받아 실시간으로 보여주는 웹훅 디버깅 도구
- 줄 세우기(큐)·실시간 푸시·로그인 검증까지 서비스 내부 구조를 직접 설계·구현
- 동작하는 시제품 완성, 대규모 운영을 위한 안정화는 일부 과제로 남음
</br>

### 1️⃣ 문제 정의 / 배경
  - 외부 서비스(GitHub·Stripe 등)는 인터넷 공개 주소로만 웹훅을 보낼 수 있다.
  - 그런데 개발 중인 내 PC(localhost)는 공개 주소가 없어 웹훅을 직접 받지 못한다.
  - 그래서 개발자는 그 웹훅이 정확히 어떤 데이터인지 확인하기가 번거롭다.
  - 기존 도구(ngrok 등)는 주소가 매번 바뀌고 설치가 필요한 불편함이 있다.

## 💻 서비스 기능

### 핵심 기능 01
- 개발자별 고유 웹훅 수신 URL 발급 — 추측 불가능한 영구 주소를 사람마다 하나씩 제공

### 핵심 기능 02
- 수신 웹훅 실시간 시각화 — 웹훅이 도착하면 새로고침 없이 1초 안에 대시보드에 자동 표시

</br>

## 🏛️ 시스템 아키텍처
