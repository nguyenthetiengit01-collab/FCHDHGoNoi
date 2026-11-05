export type ActivityCategory =
  | "all"
  | "anhbia"
  | "giaidau"
  | "giaoluu"
  | "cauthu"
  | "taitro";

export interface ClubActivityPost {
  id: string;
  category: "anhbia" | "giaidau" | "giaoluu" | "cauthu" | "taitro";
  categoryLabel: string;
  categoryBadgeClass: string;
  title: string;
  slug: string;
  summary: string;
  publishedDate: string;
  author: string;
  featuredImage: string;
  galleryImages?: string[];
  readingTime: string;
  paragraphs: string[];
  quote?: string;
  highlights?: string[];
}

export const ACTIVITY_CATEGORIES: Array<{
  id: ActivityCategory;
  label: string;
  iconName: string;
  description: string;
}> = [
  {
    id: "all",
    label: "Tất cả hoạt động",
    iconName: "Flame",
    description: "Toàn bộ tin tức, giải đấu, giao lưu và khoảnh khắc của FC HĐH Gò Nổi",
  },
  {
    id: "giaidau",
    label: "Giải Đấu & Phong Trào",
    iconName: "Trophy",
    description: "Những trận cầu nảy lửa, tinh thần chiến đấu hết mình tại các giải phủi đồng hương",
  },
  {
    id: "giaoluu",
    label: "Giao Lưu Kết Nối",
    iconName: "HeartHandshake",
    description: "Những trận giao hữu thân mật, thắt chặt nghĩa tình với các đội bạn và hội đồng hương",
  },
  {
    id: "cauthu",
    label: "Cầu Thủ Gò Nổi",
    iconName: "Users",
    description: "Gương mặt, câu chuyện và những khoảnh khắc tỏa sáng của 23+ chiến binh sân cỏ",
  },
  {
    id: "taitro",
    label: "Đồng Hành & Tài Trợ",
    iconName: "Award",
    description: "Tri ân các mạnh thường quân, doanh nhân quê hương tiếp sức cho đội bóng",
  },
  {
    id: "anhbia",
    label: "Ảnh Bìa & Khí Thế",
    iconName: "Camera",
    description: "Những khung hình tập thể trang trọng, đại diện cho bản sắc và tinh thần FC Gò Nổi",
  },
];

export const CLUB_ACTIVITIES_POSTS: ClubActivityPost[] = [
  {
    id: "post-gd-1",
    category: "giaidau",
    categoryLabel: "Giải Đấu & Phong Trào",
    categoryBadgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    title: "Rực lửa sân 7 Sài Gòn: Hành trình quả cảm của FC HĐH Gò Nổi tại giải bóng đá đồng hương",
    slug: "hanh-trinh-giai-dau-phong-trao-go-noi",
    publishedDate: "2026-10-25",
    author: "Ban Truyền Thông FC Gò Nổi",
    readingTime: "4 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaidau/DSC06522.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaidau/DSC06290.webp",
      "/images/hinhanh-webp/giaidau/DSC06526.webp",
      "/images/hinhanh-webp/giaidau/DSC06530.webp",
      "/images/hinhanh-webp/giaidau/DSC06730.webp",
    ],
    summary:
      "Dưới ánh đèn rực rỡ của các sân cỏ nhân tạo TP.HCM, những bước chạy thanh thoát và lối đá máu lửa của anh em Gò Nổi đã tạo nên những trận cầu nghẹt thở, cống hiến trọn vẹn cho người hâm mộ quê nhà.",
    paragraphs: [
      "Bước vào mỗi giải đấu phong trào, FC HĐH Gò Nổi luôn mang trong mình niềm tự hào đại diện cho mảnh đất ba xã Điện Quang, Điện Trung, Điện Phong. Không chỉ là sự so tài về kỹ chiến thuật trên mặt cỏ nhân tạo, mỗi trận đấu là dịp để anh em khẳng định bản lĩnh kiên cường, sự bền bỉ của người con xứ Quảng xa quê.",
      "Ở từng pha bóng tranh chấp quyết liệt từ giữa sân cho đến những pha phản công thần tốc bên cánh, các cầu thủ luôn thi đấu với hơn 100% sức lực. Dưới sự chỉ đạo nhịp nhàng của Đội trưởng Thế Tiếng cùng sự chắc chắn của hàng thủ do Đội phó Viết Tín chỉ huy, đội bóng đã thể hiện lối chơi gắn kết, tôn trọng đối thủ và cống hiến những pha phối hợp đẹp mắt.",
      "Tiếng reo hò từ đường biên của các cổ động viên đồng hương là nguồn động lực to lớn giúp các cầu thủ vượt qua những thời khắc căng thẳng nhất. Dù thắng hay hòa, điều đọng lại sâu sắc nhất vẫn là tinh thần fair-play, nụ cười rạng rỡ và sự tự hào khi cùng khoác lên mình màu áo quê hương.",
    ],
    quote: "Đá phủi bằng cả trái tim, thắng không kiêu, bại không nản — quan trọng nhất là tinh thần Gò Nổi luôn rực sáng!",
    highlights: [
      "Lối đá ban bật ngắn, gắn kết và giàu năng lượng",
      "Sự kết hợp ăn ý giữa thế hệ dạn dày kinh nghiệm và các nhân tố trẻ",
      "Sự cổ vũ nồng nhiệt của bà con đồng hương Gò Nổi tại TP.HCM",
    ],
  },
  {
    id: "post-gd-2",
    category: "giaidau",
    categoryLabel: "Giải Đấu & Phong Trào",
    categoryBadgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    title: "Khoảnh khắc vỡ òa: Niềm vui ghi bàn và tinh thần ăn mừng bất diệt",
    slug: "khoanh-khac-vo-oa-ban-thang",
    publishedDate: "2026-10-18",
    author: "BQL Đội bóng",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaidau/DSC06530.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaidau/DSC06535.webp",
      "/images/hinhanh-webp/giaidau/DSC06553.webp",
      "/images/hinhanh-webp/giaidau/DSC06751.webp",
    ],
    summary:
      "Một cú vung chân quyết đoán đưa bóng găm thẳng vào góc lưới, và rồi tất cả ôm chầm lấy nhau trong niềm hạnh phúc tột cùng. Đó là khoảnh khắc kỳ diệu chỉ bóng đá mới có thể đem lại.",
    paragraphs: [
      "Bàn thắng trong bóng đá phủi không chỉ mang về điểm số, mà nó là sự kết tinh của hàng chục pha chuyền bóng, của những giọt mồ hôi rơi sau những giờ làm việc mệt nhọc trong tuần. Khi lưới đối phương rung lên, mọi lo toan thường nhật dường như tan biến.",
      "Những cái ôm siết chặt, những nụ cười tỏa nắng trên khuôn mặt thấm đẫm mồ hôi đã minh chứng cho tình đồng đội keo sơn. Tại FC HĐH Gò Nổi, người ghi bàn là niềm vui chung của toàn đội, và người kiến tạo cũng được tôn vinh xứng đáng.",
    ],
    quote: "Bóng đá đẹp nhất khi đồng đội cùng chia sẻ niềm vui chiến thắng và dìu nhau đứng dậy sau những pha bóng khó.",
    highlights: [
      "Những siêu phẩm sút xa và phối hợp nhóm nhuần nhuyễn",
      "Tinh thần sẻ chia niềm vui, gắn kết anh em trên sân",
    ],
  },
  {
    id: "post-gl-1",
    category: "giaoluu",
    categoryLabel: "Giao Lưu Kết Nối",
    categoryBadgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    title: "Giao lưu nghĩa tình: Kết nối bền chặt giữa FC Gò Nổi và các CLB đồng hương tại TP.HCM",
    slug: "giao-luu-ket-noi-dong-huong-tp-hcm",
    publishedDate: "2026-10-22",
    author: "Đội phó Hồ Viết Tín",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaoluu/2a0ee93bb4f234ac6de32.webp",
      "/images/hinhanh-webp/giaoluu/30a151040ccd8c93d5dc8.webp",
      "/images/hinhanh-webp/giaoluu/f799b42fe9e669b830f79.webp",
    ],
    summary:
      "Những buổi giao hữu cuối tuần không chỉ rèn luyện sức khỏe mà còn là cơ hội quý báu để mở rộng mạng lưới giao lưu, hỗ trợ nhau trong cuộc sống và công việc tại thành phố mang tên Bác.",
    paragraphs: [
      "Bên cạnh các giải đấu chính thức, FC HĐH Gò Nổi thường xuyên tổ chức các trận đấu giao hữu cọ xát với các đội bóng đồng hương Điện Bàn, Duy Xuyên, Đại Lộc và các câu lạc bộ doanh nghiệp trẻ tại TP.HCM.",
      "Trước trận đấu, anh em bắt tay chào hỏi nồng hậu; trong trận đấu thì so tài quyết liệt nhưng mẫu mực; sau trận đấu lại quây quần bên nhau chia sẻ những câu chuyện về quê hương, về những dự định phát triển nghề nghiệp và kết nối các cơ hội hợp tác kinh doanh.",
      "Đây chính là giá trị cốt lõi mà Ban Điều Hành đội bóng luôn hướng tới: thể thao làm cầu nối gắn kết tình đồng hương, biến sân bóng thành điểm tựa tinh thần ấm áp cho những người con xa xứ.",
    ],
    quote: "Ra sân là đối thủ trên từng đường bóng, rời sân là anh em chí cốt một nhà!",
    highlights: [
      "Kết nối thường xuyên với các hội đồng hương bạn tại TP.HCM",
      "Mở rộng giao lưu văn hóa, thể thao và hợp tác công việc",
    ],
  },
  {
    id: "post-ct-1",
    category: "cauthu",
    categoryLabel: "Cầu Thủ Gò Nổi",
    categoryBadgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    title: "23+ Chiến binh Gò Nổi: Tinh thần nhiệt huyết, sức trẻ và bản lĩnh sân cỏ",
    slug: "23-chien-binh-go-noi-tinh-than-nhiet-huyet",
    publishedDate: "2026-10-20",
    author: "Ban Quản Lý Đội",
    readingTime: "4 phút đọc",
    featuredImage: "/images/hinhanh-webp/cauthu/05f39aceaf732e2d776225.webp",
    galleryImages: [
      "/images/hinhanh-webp/cauthu/53bf36c3037e8220db6f.webp",
      "/images/hinhanh-webp/cauthu/671f762b4396c2c89b871.webp",
      "/images/hinhanh-webp/cauthu/9eb2c38ff632776c2e2322.webp",
      "/images/hinhanh-webp/cauthu/420f523b6786e6d8bf973.webp",
    ],
    summary:
      "Mỗi cầu thủ là một câu chuyện riêng về tình yêu bóng đá và lòng hướng về cội nguồn. Từ anh em sinh viên cho đến các kỹ sư, nhân viên văn phòng, tất cả cùng chung nhịp đập khi xỏ giày ra sân.",
    paragraphs: [
      "Đội hình hiện tại của FC HĐH Gò Nổi quy tụ hơn 23 thành viên nòng cốt và đang tiếp tục kết nạp thêm nhiều nhân tố mới. Điều đặc biệt là mỗi cầu thủ đều sở hữu một thẻ Profile cá nhân 3D trên hệ thống website, nơi anh em có thể tự do viết lời giới thiệu, thể hiện phong cách thi đấu và phương châm sống của mình.",
      "Từ vị trí thủ môn kiên cường, các hậu vệ lăn xả cản phá, những tiền vệ điều phối nhịp nhàng đến các tiền đạo chớp thời cơ nhạy bén — mỗi cá nhân đều là một mảnh ghép không thể thiếu tạo nên sức mạnh đoàn kết của đội bóng.",
      "Dù công việc thường ngày có bận rộn đến đâu, cứ đến tối thứ Bảy hay sáng Chủ Nhật, anh em lại cùng nhau ra sân với nụ cười sảng khoái và tinh thần tràn đầy năng lượng tích cực.",
    ],
    quote: "Không quan trọng bạn đá ở vị trí nào, chỉ cần bạn mang trong mình tinh thần Gò Nổi — bạn là một phần của chiến thắng!",
    highlights: [
      "Đội hình 23+ cầu thủ đa dạng độ tuổi, giàu nhiệt huyết",
      "Tính năng Profile cá nhân tự sửa độc đáo trên website",
      "Chào đón tất cả anh em đồng hương muốn gia nhập",
    ],
  },
  {
    id: "post-tt-1",
    category: "taitro",
    categoryLabel: "Đồng Hành & Tài Trợ",
    categoryBadgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    title: "Tri ân những tấm lòng vàng: Tiếp sức cho ngọn lửa bóng đá FC HĐH Gò Nổi",
    slug: "tri-an-nha-tai-tro-tiep-suc-doi-bong",
    publishedDate: "2026-10-15",
    author: "Đội trưởng Nguyễn Thế Tiếng",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/taitro/16a77ea82361a33ffa703.webp",
    galleryImages: [
      "/images/hinhanh-webp/taitro/d120b134ecfd6ca335ec4.webp",
    ],
    summary:
      "Sự đồng hành của các doanh nghiệp, mạnh thường quân và các thế hệ anh em đi trước là nguồn động viên vô giá giúp đội bóng duy trì sân chơi thể thao chất lượng và bền vững.",
    paragraphs: [
      "Để FC HĐH Gò Nổi duy trì hoạt động bài bản và tham gia đều đặn các giải đấu phong trào, sự chung tay tiếp sức từ các nhà tài trợ và mạnh thường quân có ý nghĩa đặc biệt to lớn.",
      "Từ những bộ áo đấu rực rỡ mang biểu tượng quê hương, kinh phí thuê sân bãi tập luyện, đến những phần quà khích lệ tinh thần sau mỗi trận thắng — tất cả đều thể hiện sự quan tâm sâu sắc của cộng đồng người Gò Nổi đối với thế hệ trẻ.",
      "Ban Điều Hành đội bóng xin gửi lời tri ân chân thành nhất tới quý nhà tài trợ, các anh chị đồng hương đã luôn dõi theo và đồng hành. Đội cam kết sử dụng mọi nguồn tài trợ một cách minh bạch, hiệu quả và luôn thi đấu hết mình vì danh dự màu cờ sắc áo Gò Nổi.",
    ],
    quote: "Mỗi sự ủng hộ, đồng hành là một viên gạch xây đắp nên mái nhà chung ấm áp nghĩa tình quê hương.",
    highlights: [
      "Tri ân các nhà tài trợ trang phục thi đấu và quỹ đội",
      "Minh bạch tài chính 100% công khai trên cổng thông tin",
      "Mời gọi các doanh nghiệp đồng hương tiếp tục đồng hành",
    ],
  },
  {
    id: "post-ab-1",
    category: "anhbia",
    categoryLabel: "Ảnh Bìa & Khí Thế",
    categoryBadgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    title: "Bức ảnh đại diện: Dấu ấn tập thể kiên trung và khát vọng vươn xa",
    slug: "buc-anh-dai-dien-khi-the-fc-go-noi",
    publishedDate: "2026-10-10",
    author: "Ban Truyền Thông FC Gò Nổi",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/anhbia/DSC06734.webp",
    galleryImages: [
      "/images/hinhanh-webp/anhbia/IMG_5574.webp",
      "/images/hinhanh-webp/anhbia/IMG_5575.webp",
      "/images/hinhanh-webp/anhbia/IMG_5576.webp",
      "/images/hinhanh-webp/anhbia/673ca5fcf835786b21245.webp",
    ],
    summary:
      "Khoảnh khắc toàn đội cùng khoác vai nhau đứng dưới ánh mặt trời rực rỡ, ánh mắt rạng ngời niềm tin và khí thế chuẩn bị cho một chặng đường phát triển mới.",
    paragraphs: [
      "Bức ảnh bìa chính thức của đội bóng được chụp vào một buổi chiều thi đấu rực nắng tại sân bóng TP.HCM. Từng nụ cười, từng dáng đứng hiên ngang trong bộ áo đấu vàng - xanh sapphire đã tạo nên một hình ảnh đầy cảm xúc về sự đoàn kết.",
      "Đó không đơn thuần là một tấm ảnh kỷ niệm, mà là lời khẳng định về một tập thể đồng hương gắn bó, vững vàng trước mọi thử thách và luôn sẵn lòng dang rộng vòng tay đón nhận bất kỳ người con Gò Nổi nào gia nhập.",
    ],
    quote: "Một người vì mọi người, mọi người vì màu cờ sắc áo Gò Nổi!",
    highlights: [
      "Hình ảnh nhận diện chính thức trên toàn bộ cổng thông tin",
      "Biểu tượng của sự gắn kết và tinh thần bất khuất quê hương",
    ],
  },
];
