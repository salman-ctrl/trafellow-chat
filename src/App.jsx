import { useEffect, useState, useRef } from "react";
import io from "socket.io-client";
import { Send, User, LogOut, MessageCircle, Circle } from "lucide-react";

const socket = io("http://localhost:5000");

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const [users, setUsers] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [typingUsers, setTypingUsers] = useState({});
  const [unreadCount, setUnreadCount] = useState({});
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = localStorage.getItem("user");
    
    if (token && user) {
      setIsAuthenticated(true);
      setCurrentUser(JSON.parse(user));
    }
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    socket.emit("userOnline", currentUser.id);

    socket.on("receivePrivateMessage", (data) => {
      if (selectedContact && 
          (data.sender_id === selectedContact.id || data.receiver_id === selectedContact.id)) {
        setMessages(prev => [...prev, data]);
        
        if (data.sender_id === selectedContact.id) {
          fetch("http://localhost:5000/messages/read", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              userId: currentUser.id, 
              contactId: selectedContact.id 
            })
          });
        }
      } else {
        fetchUnreadCount();
      }
    });

    socket.on("userStatusChanged", ({ userId, isOnline }) => {
      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, isOnline } : user
      ));
    });

    socket.on("userTyping", ({ userId, isTyping }) => {
      setTypingUsers(prev => ({ ...prev, [userId]: isTyping }));
      
      if (isTyping) {
        setTimeout(() => {
          setTypingUsers(prev => ({ ...prev, [userId]: false }));
        }, 3000);
      }
    });

    return () => {
      socket.off("receivePrivateMessage");
      socket.off("userStatusChanged");
      socket.off("userTyping");
    };
  }, [currentUser, selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (currentUser) {
      fetchUsers();
      fetchUnreadCount();
    }
  }, [currentUser]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`http://localhost:5000/users/${currentUser.id}`);
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const response = await fetch(`http://localhost:5000/messages/unread/${currentUser.id}`);
      const data = await response.json();
      setUnreadCount(data);
    } catch (error) {
      console.error("Error fetching unread count:", error);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    
    const endpoint = authMode === "login" 
      ? "http://localhost:5000/auth/login"
      : "http://localhost:5000/auth/register";
    
    const body = authMode === "login"
      ? { username, password }
      : { username, email, password };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setCurrentUser(data.user);
        setIsAuthenticated(true);
      } else {
        alert(data.error || "Authentication failed");
      }
    } catch (error) {
      alert("Connection error. Please try again.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setIsAuthenticated(false);
    setCurrentUser(null);
    setSelectedContact(null);
    setMessages([]);
  };

  const selectContact = async (contact) => {
    setSelectedContact(contact);
    
    try {
      const response = await fetch(
        `http://localhost:5000/messages/${currentUser.id}/${contact.id}`
      );
      const data = await response.json();
      setMessages(data);
      
      await fetch("http://localhost:5000/messages/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId: currentUser.id, 
          contactId: contact.id 
        })
      });
      
      setUnreadCount(prev => {
        const newCount = { ...prev };
        delete newCount[contact.id];
        return newCount;
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const sendMessage = () => {
    if (!messageInput.trim() || !selectedContact) return;

    socket.emit("sendPrivateMessage", {
      senderId: currentUser.id,
      receiverId: selectedContact.id,
      message: messageInput
    });

    const newMessage = {
      sender_id: currentUser.id,
      receiver_id: selectedContact.id,
      message: messageInput,
      created_at: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setMessageInput("");
  };

  const handleTyping = () => {
    if (!selectedContact) return;

    socket.emit("typing", {
      userId: currentUser.id,
      contactId: selectedContact.id,
      isTyping: true
    });

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", {
        userId: currentUser.id,
        contactId: selectedContact.id,
        isTyping: false
      });
    }, 1000);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
          <div className="text-center mb-8">
            <MessageCircle className="w-16 h-16 mx-auto text-blue-500 mb-4" />
            <h1 className="text-3xl font-bold text-gray-800">Trafellow Chat</h1>
            <p className="text-gray-600 mt-2">Connect with hundreds of users</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAuth(e)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            {authMode === "register" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleAuth(e)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleAuth(e)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>

            <button
              onClick={handleAuth}
              className="w-full bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              {authMode === "login" ? "Login" : "Register"}
            </button>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}
              className="text-blue-500 hover:underline text-sm"
            >
              {authMode === "login" 
                ? "Don't have an account? Register" 
                : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-purple-600">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src={currentUser.avatar} 
                alt={currentUser.username}
                className="w-10 h-10 rounded-full border-2 border-white"
              />
              <div>
                <h2 className="font-semibold text-white">{currentUser.username}</h2>
                <p className="text-xs text-blue-100">Online</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">
              Users ({users.length})
            </h3>
            {users.map(user => (
              <button
                key={user.id}
                onClick={() => selectContact(user)}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors mb-1 ${
                  selectedContact?.id === user.id
                    ? "bg-blue-50 border border-blue-200"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="relative">
                  <img 
                    src={user.avatar} 
                    alt={user.username}
                    className="w-12 h-12 rounded-full"
                  />
                  <Circle 
                    className={`w-3 h-3 absolute bottom-0 right-0 ${
                      user.isOnline ? "fill-green-500 text-green-500" : "fill-gray-400 text-gray-400"
                    }`}
                  />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-800">{user.username}</p>
                    {unreadCount[user.id] && (
                      <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1">
                        {unreadCount[user.id]}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {user.isOnline ? "Online" : "Offline"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedContact ? (
          <>
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <img 
                  src={selectedContact.avatar} 
                  alt={selectedContact.username}
                  className="w-10 h-10 rounded-full"
                />
                <div>
                  <h3 className="font-semibold text-gray-800">
                    {selectedContact.username}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {typingUsers[selectedContact.id] 
                      ? "typing..." 
                      : selectedContact.isOnline ? "Online" : "Offline"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((msg, idx) => {
                const isSentByMe = msg.sender_id === currentUser.id;
                return (
                  <div
                    key={idx}
                    className={`flex ${isSentByMe ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        isSentByMe
                          ? "bg-blue-500 text-white rounded-br-none"
                          : "bg-white text-gray-800 rounded-bl-none shadow"
                      }`}
                    >
                      <p className="break-words">{msg.message}</p>
                      <p className={`text-xs mt-1 ${
                        isSentByMe ? "text-blue-100" : "text-gray-500"
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="bg-white border-t border-gray-200 p-4">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    handleTyping();
                  }}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
                <button
                  onClick={sendMessage}
                  className="bg-blue-500 text-white p-3 rounded-full hover:bg-blue-600 transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MessageCircle className="w-24 h-24 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">
                Select a user to start chatting
              </h3>
              <p className="text-gray-500">
                Choose from {users.length} available users
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}