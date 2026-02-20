/**
 * 魔术评论系统 - 后端服务（适配所有新需求：评论头像上传/跳转功能等）
 * 核心功能：
 * 1. 提供API接口，处理文件上传/删除、配置管理、评论管理
 * 2. 支持评论用户头像上传（已有接口，无需新增）
 * 3. 所有接口保持兼容，仅补充注释说明
 * 作者：豆包编程助手
 * 日期：2025-12-14
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 初始化Express应用
const app = express();
const PORT = 3000;

// ===================== 基础配置 =====================
// 解决跨域问题（允许所有来源跨域请求）
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

// 配置JSON解析和静态文件服务
app.use(express.json({ limit: '10mb' })); // 支持大文件上传的JSON解析
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static('public')); // 静态文件目录（前端页面）
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads'))); // 上传文件访问目录

// ===================== 目录管理 =====================
/**
 * 安全创建目录（不存在则创建）
 * @param {string} dirPath - 目录路径
 */
const createDirIfNotExist = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        try {
            // recursive: 递归创建多级目录，mode: 设置目录权限
            fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
            console.log(`✅ Directory created successfully: ${dirPath}`);
        } catch (err) {
            console.error(`❌ Failed to create directory ${dirPath}:`, err.message);
            throw err; // 抛出错误让上层处理
        }
    }
};

// 定义核心目录路径（使用resolve确保绝对路径，兼容Windows/Linux）
const uploadRoot = path.resolve(__dirname, 'uploads'); // 上传文件根目录
const iconDir = path.resolve(uploadRoot, 'icons');     // 图标存储目录
const imagesDir = path.resolve(uploadRoot, 'images'); // 轮播图存储目录
const reviewImagesDir = path.resolve(uploadRoot, 'review-images'); // 评论图片存储目录
const userAvatarsDir = path.resolve(uploadRoot, 'avatars'); // 用户头像存储目录（评论用户头像）
const dataDir = path.resolve(__dirname, 'data');       // 配置文件存储目录

// 创建必要目录
createDirIfNotExist(uploadRoot);
createDirIfNotExist(iconDir);
createDirIfNotExist(imagesDir);
createDirIfNotExist(reviewImagesDir);
createDirIfNotExist(userAvatarsDir);
createDirIfNotExist(dataDir);

// ===================== 文件上传配置（multer） =====================
/**
 * 文件存储配置
 * destination: 指定文件存储目录
 * filename: 生成唯一文件名，避免重复
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 根据字段名区分存储目录
        if (file.fieldname === 'icon') {
            cb(null, iconDir);
        } else if (file.fieldname === 'images') {
            cb(null, imagesDir);
        } else if (file.fieldname === 'reviewImages') {
            cb(null, reviewImagesDir);
        } else if (file.fieldname === 'userAvatar') { // 评论用户头像字段
            cb(null, userAvatarsDir);
        } else {
            cb(new Error(`❌ Unsupported file type: ${file.fieldname}`), null);
        }
    },
    filename: (req, file, cb) => {
        // 提取文件扩展名，生成唯一文件名
        const ext = path.extname(file.originalname).toLowerCase();
        const baseName = path.basename(file.originalname, ext);
        // 格式：原文件名-时间戳-随机字符串.扩展名
        const uniqueName = `${baseName}-${Date.now()}-${Math.random().toString(36).substr(2, 8)}${ext}`;
        cb(null, uniqueName);
    }
});

/**
 * 文件过滤（仅允许指定格式）
 * @param {object} req - 请求对象
 * @param {object} file - 文件对象
 * @param {function} cb - 回调函数
 */
const fileFilter = (req, file, cb) => {
    const allowedExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp']; // 允许的文件格式
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExts.includes(ext)) {
        cb(null, true); // 允许上传
    } else {
        cb(new Error(`❌ 仅支持以下格式: ${allowedExts.join(', ')}`), false); // 拒绝上传
    }
};

// 初始化multer上传实例
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 单文件最大5MB
        files: 10 // 单次最多上传10个文件
    }
});

// ===================== 数据文件路径配置 =====================
const RESTAURANT_FILE = path.resolve(dataDir, 'restaurant.json'); // 餐厅配置文件（含简介）
const COMMENTS_FILE = path.resolve(dataDir, 'comments.json');     // 评论数据文件（含用户头像）

// ===================== 工具函数 =====================
/**
 * 安全读取JSON文件
 * @param {string} filePath - 文件路径
 * @returns {object|null} - JSON数据或null（读取失败）
 */
const readJsonFile = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) return null;
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) {
        console.error(`❌ 读取文件失败 ${filePath}:`, err.message);
        return null;
    }
};

/**
 * 安全写入JSON文件
 * @param {string} filePath - 文件路径
 * @param {object} data - 要写入的数据
 * @returns {boolean} - 是否写入成功
 */
const writeJsonFile = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (err) {
        console.error(`❌ 写入文件失败 ${filePath}:`, err.message);
        return false;
    }
};

/**
 * 删除文件（存在则删除）
 * @param {string} filePath - 相对路径（如：uploads/icons/xxx.png）
 * @returns {boolean} - 是否删除成功
 */
const deleteFileIfExist = (filePath) => {
    try {
        const fullPath = path.resolve(__dirname, filePath); // 转换为绝对路径
        if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath); // 删除文件
            console.log(`✅ File deleted: ${fullPath}`);
            return true;
        }
        console.log(`⚠️ File does not exist: ${fullPath}`);
        return false;
    } catch (err) {
        console.error(`❌ 删除文件失败:`, err.message);
        return false;
    }
};

// ===================== 初始化默认配置 =====================
const initDataFiles = () => {
    // 初始化餐厅配置文件（含简介）
    if (!fs.existsSync(RESTAURANT_FILE)) {
        const defaultConfig = {
            name: 'The Wine Shop', // 匹配参考图商家名
            rating: 4.6, // 匹配参考图评分
            addr: 'Bruckenstr. 35, 60364 Frankfurt am Main',
            phone: '+089 661 2744',
            realUrl: 'https://maps.google.com/', // 真实评论页面地址（长按跳转）
            type: '酒行', 
            status: '已打烊', 
            intro: 'The Wine Shop 位于法兰克福市中心，主营各类进口葡萄酒、精酿啤酒及特色小食，是当地极具人气的酒水体验店。店内环境舒适，店员专业热情，为顾客提供个性化的酒水推荐服务。',
            icon: '',
            images: []
        };
        writeJsonFile(RESTAURANT_FILE, defaultConfig);
        console.log('✅ Default restaurant configuration created (adapted for Google reviews style + new introduction)');
    }

    // 初始化评论文件（含用户头像字段）
    if (!fs.existsSync(COMMENTS_FILE)) {
        const defaultComments = [
            {
                name: 'Link LL',
                userAvatar: '', // 新增：评论用户头像路径
                label: '本地向导', 
                reviewCount: '104条评价',
                photoCount: '405张照片',
                rating: 4,
                time: '4周前',
                content: '食物 啤酒 OK',
                reviewImages: [ 
                    "https://via.placeholder.com/200/333333/ffffff?text=Food1",
                    "https://via.placeholder.com/200/333333/ffffff?text=Food2",
                    "https://via.placeholder.com/200/333333/ffffff?text=Food3",
                    "https://via.placeholder.com/200/333333/ffffff?text=Beer"
                ],
                isUserAdd: false,
                likeCount: 0, // 新增：点赞数（前端本地维护）
                isLiked: false // 新增：是否点赞（前端本地）
            },
            {
                name: 'Lai Hao Sheng',
                userAvatar: '',
                label: '',
                reviewCount: '7条评价',
                photoCount: '1张照片',
                rating: 5,
                time: '3年前',
                content: '非常nice 食物都很好吃 地方也很不错',
                reviewImages: [
                    "https://via.placeholder.com/200/333333/ffffff?text=Shop"
                ],
                isUserAdd: false,
                likeCount: 0,
                isLiked: false
            }
        ];
        writeJsonFile(COMMENTS_FILE, defaultComments);
        console.log('✅ Default comments file created (supports user avatars + likes)');
    }
};

// ===================== API接口 =====================
/**
 * 1. 获取餐厅配置（含真实跳转地址）
 * GET /api/restaurant
 */
app.get('/api/restaurant', (req, res) => {
    const config = readJsonFile(RESTAURANT_FILE) || {};
    res.json({
        code: 200,
        msg: 'success',
        data: config
    });
});

/**
 * 2. 保存餐厅配置（支持商家类型、营业状态、简介）
 * POST /api/restaurant
 */
app.post('/api/restaurant', (req, res) => {
    const newConfig = req.body;
    if (!newConfig) {
        return res.json({
            code: 400,
            msg: 'Configuration data cannot be empty'
        });
    }

    // 处理需要删除的图片（轮播图删除时标记）
    if (Array.isArray(newConfig.deletedImages)) {
        newConfig.deletedImages.forEach(imgPath => {
            deleteFileIfExist(imgPath);
        });
        delete newConfig.deletedImages; // 从配置中移除该字段
    }

    // 补全默认值
    const finalConfig = {
        name: newConfig.name || 'The Wine Shop',
        rating: isNaN(parseFloat(newConfig.rating)) ? 4.6 : parseFloat(newConfig.rating),
        addr: newConfig.addr || 'Bruckenstr. 35, 60364 Frankfurt am Main',
        phone: newConfig.phone || '+089 661 2744',
        realUrl: newConfig.realUrl || 'https://maps.google.com/', // 真实评论页面地址
        type: newConfig.type || 'Wine Shop', 
        status: newConfig.status || 'Closed', 
        intro: newConfig.intro || 'No introduction available', 
        icon: newConfig.icon || '',
        images: Array.isArray(newConfig.images) ? newConfig.images : []
    };

    // 保存配置文件
    const isSuccess = writeJsonFile(RESTAURANT_FILE, finalConfig);
    if (isSuccess) {
        res.json({
            code: 200,
            msg: 'Configuration saved successfully',
            data: finalConfig
        });
    } else {
        res.json({
            code: 500,
            msg: 'Configuration save failed, please check server permissions'
        });
    }
});

/**
 * 3. 获取评论列表（支持排序：time/newest、rating/asc、rating/desc）
 * GET /api/comments?sort=time/newest | rating/asc | rating/desc
 */
app.get('/api/comments', (req, res) => {
    let comments = readJsonFile(COMMENTS_FILE) || [];
    const sortType = req.query.sort || '';

    // 实现评论排序逻辑
    switch (sortType) {
        case 'time/newest': // 从新到旧
            comments.sort((a, b) => {
                const aTimeScore = getTimeScore(a.time);
                const bTimeScore = getTimeScore(b.time);
                return bTimeScore - aTimeScore;
            });
            break;
        case 'rating/desc': // 评分由高到低
            comments.sort((a, b) => b.rating - a.rating);
            break;
        case 'rating/asc': // 评分由低到高
            comments.sort((a, b) => a.rating - b.rating);
            break;
        default: // 默认不排序
            break;
    }

    res.json({
        code: 200,
        msg: 'success',
        data: comments
    });
});

/**
 * 时间评分工具函数（用于简单时间排序）
 * @param {string} timeStr - 时间字符串（如：4周前、3年前）
 * @returns {number} 评分（数值越大越新）
 */
const getTimeScore = (timeStr) => {
    if (!timeStr) return 0;
    if (timeStr.includes('周')) return parseInt(timeStr) || 0 + 100;
    if (timeStr.includes('月')) return parseInt(timeStr) || 0 + 50;
    if (timeStr.includes('年')) return parseInt(timeStr) || 0;
    return 0;
};

/**
 * 4. 批量更新评论（替换全部）
 * PUT /api/comments
 */
app.put('/api/comments', (req, res) => {
    const newComments = req.body;
    if (!Array.isArray(newComments)) {
        return res.json({
            code: 400,
            msg: 'Comments data must be an array'
        });
    }

    const isSuccess = writeJsonFile(COMMENTS_FILE, newComments);
    if (isSuccess) {
        res.json({
            code: 200,
            msg: 'Comments updated successfully',
            data: newComments
        });
    } else {
        res.json({
            code: 500,
            msg: 'Comments update failed'
        });
    }
});

/**
 * 5. 添加单条评论（支持用户头像）
 * POST /api/comments
 */
app.post('/api/comments', (req, res) => {
    const newComment = req.body;
    // 验证必填字段
    if (!newComment || !newComment.content || !newComment.rating) {
        return res.json({
            code: 400,
            msg: 'Comment content and rating cannot be empty'
        });
    }

    const comments = readJsonFile(COMMENTS_FILE) || [];
    // 构造评论数据（补全扩展字段）
    const commentToAdd = {
        name: newComment.name || 'Guest',
        userAvatar: newComment.userAvatar || '', // 评论用户头像
        label: newComment.label || '', 
        reviewCount: newComment.reviewCount || '0 reviews',
        photoCount: newComment.photoCount || '0 photos',
        rating: parseInt(newComment.rating) || 5,
        time: newComment.time || 'Just now', 
        content: newComment.content,
        reviewImages: Array.isArray(newComment.reviewImages) ? newComment.reviewImages : [],
        isUserAdd: newComment.isUserAdd || true,
        likeCount: 0, // 初始点赞数0
        isLiked: false // 初始未点赞
    };
    comments.unshift(commentToAdd); // 新增评论放在最前面

    const isSuccess = writeJsonFile(COMMENTS_FILE, comments);
    if (isSuccess) {
        res.json({
            code: 200,
            msg: 'Comment added successfully',
            data: commentToAdd
        });
    } else {
        res.json({
            code: 500,
            msg: 'Comment save failed'
        });
    }
});

/**
 * 6. 删除单条评论
 * DELETE /api/comments/:index
 */
app.delete('/api/comments/:index', (req, res) => {
    const index = parseInt(req.params.index);
    const comments = readJsonFile(COMMENTS_FILE) || [];

    // 验证索引有效性
    if (index < 0 || index >= comments.length) {
        return res.json({
            code: 400,
            msg: 'Invalid comment index'
        });
    }

    // 删除评论图片文件（如果有）
    const commentToDelete = comments[index];
    if (Array.isArray(commentToDelete.reviewImages)) {
        commentToDelete.reviewImages.forEach(imgPath => {
            deleteFileIfExist(imgPath);
        });
    }
    // 删除用户头像文件（如果有）
    if (commentToDelete.userAvatar) {
        deleteFileIfExist(commentToDelete.userAvatar);
    }

    comments.splice(index, 1); // 删除指定索引的评论
    const isSuccess = writeJsonFile(COMMENTS_FILE, comments);
    
    if (isSuccess) {
        res.json({
            code: 200,
            msg: 'Comment deleted successfully',
            data: comments
        });
    } else {
        res.json({
            code: 500,
            msg: 'Comment deletion failed'
        });
    }
});

/**
 * 7. 上传餐厅图标
 * POST /api/upload/icon
 */
app.post('/api/upload/icon', upload.single('icon'), (req, res) => {
    try {
        if (!req.file) {
            return res.json({
                code: 400,
                msg: 'Please select an icon file to upload'
            });
        }

        // 生成前端可访问的相对路径（统一使用/分隔符）
        const iconPath = path.join('uploads', 'icons', req.file.filename).replace(/\\/g, '/');
        
        res.json({
            code: 200,
            msg: 'Icon uploaded successfully',
            data: { iconPath }
        });
    } catch (err) {
        console.error('❌ Icon upload error:', err);
        res.json({
            code: 500,
            msg: `Icon upload failed: ${err.message}`
        });
    }
});

/**
 * 8. 上传轮播图片（批量）
 * POST /api/upload/images
 */
app.post('/api/upload/images', upload.array('images', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.json({
                code: 400,
                msg: 'Please select image files to upload'
            });
        }

        // 生成轮播图路径列表（前端可访问）
        const imagePaths = req.files.map(file => {
            return path.join('uploads', 'images', file.filename).replace(/\\/g, '/');
        });

        res.json({
            code: 200,
            msg: `Successfully uploaded ${req.files.length} images`,
            data: { imagePaths }
        });
    } catch (err) {
        console.error('❌ Image upload error:', err);
        res.json({
            code: 500,
            msg: `Image upload failed: ${err.message}`
        });
    }
});

/**
 * 9. 上传评论用户头像（核心：新增评论头像支持）
 * POST /api/upload/avatar
 */
app.post('/api/upload/avatar', upload.single('userAvatar'), (req, res) => {
    try {
        if (!req.file) {
            return res.json({
                code: 400,
                msg: 'Please select an avatar file to upload'
            });
        }

        // 生成前端可访问的相对路径
        const avatarPath = path.join('uploads', 'avatars', req.file.filename).replace(/\\/g, '/');
        
        res.json({
            code: 200,
            msg: 'Avatar uploaded successfully',
            data: { avatarPath }
        });
    } catch (err) {
        console.error('❌ Avatar upload error:', err);
        res.json({
            code: 500,
            msg: `Avatar upload failed: ${err.message}`
        });
    }
});

/**
 * 10. 上传评论图片（批量）
 * POST /api/upload/review-images
 */
app.post('/api/upload/review-images', upload.array('reviewImages', 10), (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.json({
                code: 400,
                msg: 'Please select review images to upload'
            });
        }

        // 生成评论图片路径列表
        const reviewImagePaths = req.files.map(file => {
            return path.join('uploads', 'review-images', file.filename).replace(/\\/g, '/');
        });

        res.json({
            code: 200,
            msg: `Successfully uploaded ${req.files.length} review images`,
            data: { reviewImagePaths }
        });
    } catch (err) {
        console.error('❌ Review image upload error:', err);
        res.json({
            code: 500,
            msg: `Review image upload failed: ${err.message}`
        });
    }
});

/**
 * 11. 删除文件（图标/轮播图/评论图片/头像）
 * DELETE /api/delete/file
 */
app.delete('/api/delete/file', (req, res) => {
    try {
        const { filePath } = req.body;
        if (!filePath) {
            return res.json({
                code: 400,
                msg: 'File path cannot be empty'
            });
        }

        const isDeleted = deleteFileIfExist(filePath);
        if (isDeleted) {
            res.json({
                code: 200,
                msg: 'File deleted successfully',
                data: { filePath }
            });
        } else {
            res.json({
                code: 404,
                msg: 'File does not exist or deletion failed',
                data: { filePath }
            });
        }
    } catch (err) {
        console.error('❌ Delete file API error:', err);
        res.json({
            code: 500,
            msg: `File deletion exception: ${err.message}`
        });
    }
});

// ===================== 启动服务器 =====================
/**
 * 重定向接口（用于移动端、Safari 兼容的跳转）
 * GET /r
 * 从 data/restaurant.json 中读取 realUrl 并进行 302 重定向
 */
app.get('/r', (req, res) => {
    try {
        const config = readJsonFile(RESTAURANT_FILE) || {};
        const target = String(config.realUrl || '').trim();
        if (!target) return res.status(404).send('Redirect target not configured');
        if (!/^https?:\/\//i.test(target)) return res.status(400).send('Invalid redirect URL');
        console.log(`➡️ Redirecting /r -> ${target}`);
        return res.redirect(target);
    } catch (err) {
        console.error('❌ /r redirect error:', err);
        return res.status(500).send('Redirect error');
    }
});

initDataFiles(); // 初始化默认配置文件

app.listen(PORT, () => {
    console.log(`\n🚀 Server started:`);
    console.log(`- Access URL: http://localhost:${PORT}`);
    console.log(`- Admin page: http://localhost:${PORT}/admin.html`);
    console.log(`- Display page: http://localhost:${PORT}/index.html`);
    console.log(`- Upload directory: ${uploadRoot}`);
    console.log(`- Data directory: ${dataDir}\n`);
});

// 全局未捕获异常处理（防止服务器崩溃）
process.on('uncaughtException', (err) => {
    console.error('💥 Uncaught exception:', err);
});
